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
 * Keeps <meta name="theme-color"> in sync with the active theme, so the
 * iOS status bar and the Android task switcher match the app instead of
 * showing the light color pinned in index.html regardless of theme.
 */
export function syncThemeColorMeta(theme: Settings['theme']): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  meta.setAttribute('content', themeColorFor(theme))
}
