/**
 * Turns one resolved preset variant into the scoped `--pv-*` custom
 * property block a gallery preview card's miniature room paints from.
 *
 * These are deliberately a separate, `--pv-` prefixed set of custom
 * properties rather than the app's own `--bg`/`--accent`/etc - a card
 * previewing a preset that is not the currently active one must never
 * touch the live tokens painting the rest of the page underneath it. The
 * values themselves come straight from the same `ThemeTokens` object
 * `resolveTheme` reads for the real page, and `ruleAxisColors` is the same
 * function `applyResolvedTheme` uses - so a preview card can never show a
 * ruling pattern, accent, or edge shape the app itself would not actually
 * paint for that preset and mode.
 */
import { bestInk } from './contrast'
import { ruleAxisColors } from './theme'
import type { RuleStyle, ThemeTokens } from './themes'

export type PreviewStyle = Record<string, string>

export function buildPreviewStyle(tokens: ThemeTokens, ruleStyle: RuleStyle): PreviewStyle {
  const { ruleH, ruleV } = ruleAxisColors(tokens, ruleStyle)
  return {
    '--pv-bg': tokens.bg,
    '--pv-surface': tokens.surface,
    '--pv-rule-h': ruleH,
    '--pv-rule-v': ruleV,
    '--pv-rule-size': tokens.ruleSize,
    '--pv-grain': tokens.grain,
    '--pv-vignette': tokens.vignette,
    '--pv-border': tokens.border,
    '--pv-margin': tokens.margin,
    '--pv-text': tokens.text,
    '--pv-muted': tokens.muted,
    '--pv-accent': tokens.accent,
    '--pv-mark': tokens.mark,
    '--pv-mark-ink': markInk(tokens.mark),
    '--pv-font-display': tokens.fontDisplay,
    '--pv-font-body': tokens.fontBody,
    '--pv-radius': tokens.radius,
    '--pv-edge': tokens.edge,
    '--pv-shadow': tokens.shadow,
  }
}

/**
 * The highlighter chip needs readable ink on top of `--mark`, but `--mark`
 * has no guaranteed contrast partner of its own the way `--text` and
 * `--surface` do - it is meant to sit under body text on the real page,
 * not carry text of its own. Picks whichever of black or white reads
 * better against the given mark color, so a light highlighter (yellow)
 * and a dark one both stay legible without a 22nd token just for this.
 */
export function markInk(mark: string): string {
  return bestInk(mark)
}
