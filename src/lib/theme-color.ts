/**
 * Keeps <meta name="theme-color"> in sync with the resolved theme's --bg,
 * so Safari's browser chrome and the Android status bar and task switcher
 * match the app instead of showing the light color pinned in index.html
 * regardless of what is actually on screen. This has no effect on the
 * installed iOS PWA's status bar - that is governed entirely by the static
 * apple-mobile-web-app-status-bar-style meta tag, which iOS does not let a
 * running page change.
 *
 * Takes the resolved background color directly rather than a theme name -
 * with theme presets as data, there is no fixed enum of colors to look up
 * any more, only whatever resolveTheme produced for whichever preset and
 * mode are actually active. Syncing the manifest's own background_color
 * and theme_color at runtime is a later phase; see docs/THEMES.md.
 */
export function syncThemeColorMeta(bgColor: string): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  meta.setAttribute('content', bgColor)
}
