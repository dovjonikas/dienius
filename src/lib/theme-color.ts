import type { Settings } from './types'

/**
 * Mirrors the --bg values in styles.css for each theme. Kept as an explicit
 * map, rather than read from computed styles, so the browser chrome color
 * updates in the same tick as the theme itself with no dependency on
 * layout having happened yet.
 */
const THEME_COLORS: Record<Settings['theme'], string> = {
  light: '#fafaf8',
  dark: '#191a1d',
}

export function themeColorFor(theme: Settings['theme']): string {
  return THEME_COLORS[theme]
}

/**
 * Keeps <meta name="theme-color"> in sync with the active theme, so
 * Safari's browser chrome and the Android status bar and task switcher
 * match the app instead of showing the light color pinned in index.html
 * regardless of theme. This has no effect on the installed iOS PWA's
 * status bar - that is governed entirely by the static
 * apple-mobile-web-app-status-bar-style meta tag, which iOS does not let a
 * running page change.
 */
export function syncThemeColorMeta(theme: Settings['theme']): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  meta.setAttribute('content', themeColorFor(theme))
}
