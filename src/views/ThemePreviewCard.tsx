import { buildPreviewStyle } from '../lib/theme-preview'
import type { RuleStyle, ThemeTokens } from '../lib/themes'

interface ThemePreviewCardProps {
  /** The preset's display name - also this button's whole accessible name. */
  name: string
  /** Fully resolved tokens for whatever this card should show right now -
   * the caller has already merged the preset's own override patch on top
   * of its stock variant (see ThemeGallery's use of resolveVariant), so
   * this component never has to know about presets, modes or overrides at
   * all, only what to paint. */
  tokens: ThemeTokens
  ruleStyle: RuleStyle
  selected: boolean
  onSelect: () => void
}

/**
 * One gallery card: a real miniature of the room these tokens paint, not a
 * colour swatch. Every value on the card comes straight from the resolved
 * tokens the caller hands it through buildPreviewStyle - there is no
 * second, hand-guessed copy of what a theme looks like, so a card can never
 * show something the tap it represents would not actually produce.
 *
 * The card itself (border, selection ring, footer label) is styled with
 * the app's own live tokens, not the `--pv-*` preview ones - so the
 * gallery's chrome always matches whatever theme is actually active right
 * now, while the room inside each card shows the candidate theme's own
 * colours regardless of which one that is.
 */
export function ThemePreviewCard({ name, tokens, ruleStyle, selected, onSelect }: ThemePreviewCardProps) {
  const style = buildPreviewStyle(tokens, ruleStyle) as React.CSSProperties

  return (
    <button
      type="button"
      className="theme-card"
      aria-pressed={selected}
      style={style}
      onClick={onSelect}
    >
      {/* The room is a visual demonstration, not a description of this
          button - its sample copy ("Today", "Write the proposal"...) would
          otherwise get read out by a screen reader on every card in the
          gallery. Hidden from the accessibility tree so the button's own
          accessible name is just the preset's name below, which stays
          visible and unhidden - the same text a sighted person reads. */}
      <span className="theme-card-room" aria-hidden="true">
        <span className="theme-card-heading">Today</span>
        <span className="theme-card-body">Plan the morning routine</span>
        <span className="theme-card-footer">
          <span className="theme-card-row">
            <span className="theme-card-chip" />
            <span className="theme-card-item">Write the proposal</span>
          </span>
          <span className="theme-card-mark">Due today</span>
        </span>
      </span>
      <span className="theme-card-name">{name}</span>
    </button>
  )
}
