/**
 * Keeps the PWA manifest link's `background_color` and `theme_color` in
 * step with the resolved theme's background - docs/THEMES.md section 7 and
 * build order step 6.
 *
 * What this honestly buys, and what it does not: an OS reads and caches a
 * PWA's manifest exactly once, at install time, to build the splash screen
 * it shows before the page itself has painted. There is no runtime API
 * that lets a running page reach back into an *already installed*
 * home-screen icon and change that. Once someone has installed Dienius,
 * nothing here can touch their splash screen colour, no matter what it
 * does - that is an OS-level constraint, not a gap in this code.
 *
 * What it does do: a browser's install prompt (desktop Chrome's install
 * dialog, an Android "Add to Home screen" flow) reads the manifest link's
 * *current* href at the moment someone installs, not a copy fetched once
 * on first page load. So a person who tries a theme and then installs gets
 * a splash screen and initial status bar that already match it, and
 * reinstalling after switching themes updates it again on the next
 * install. Real, just much narrower than "the manifest follows the theme"
 * sounds like it should mean - see docs/THEMES.md for the same note.
 *
 * The static fields below are a deliberate, minimal copy of
 * public/manifest.webmanifest's own content, not the whole file re-read at
 * runtime - manifest-sync.test.ts checks them against the real file on
 * disk so the two cannot silently drift, the same discipline index.html's
 * pre-paint script uses for theme token data.
 */
const BASE_MANIFEST = {
  name: 'Dienius',
  short_name: 'Dienius',
  description:
    'A modular day planner built around reusable day templates. Works fully offline, all data stays on your device.',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  orientation: 'portrait',
  lang: 'en',
  icons: [
    { src: 'icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    { src: 'icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} as const

export function buildManifest(bgColor: string): Record<string, unknown> {
  return { ...BASE_MANIFEST, background_color: bgColor, theme_color: bgColor }
}

/**
 * Rewrites the `<link rel="manifest">` href to a blob url carrying the
 * resolved theme's colour. Reads the link's own previous href to decide
 * whether to revoke it - only a url this function itself created (always a
 * `blob:` url) is ever revoked, never the original static
 * `manifest.webmanifest` href a fresh page loads with.
 */
export function syncManifestTheme(bgColor: string): void {
  const link = document.querySelector('link[rel="manifest"]')
  if (!link) return
  const manifest = buildManifest(bgColor)
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  const url = URL.createObjectURL(blob)
  const previous = link.getAttribute('href')
  link.setAttribute('href', url)
  if (previous && previous.startsWith('blob:')) URL.revokeObjectURL(previous)
}
