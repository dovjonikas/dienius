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
  /**
   * Which mode these tokens are - the card carries it as a data attribute so
   * the miniature timeline inside it picks up the category colours for the
   * theme being previewed rather than the one currently painting the page.
   * The two sets live in styles.css and nowhere else; see the shared selector
   * list there.
   */
  mode: 'light' | 'dark'
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
export function ThemePreviewCard({ name, tokens, ruleStyle, mode, selected, onSelect }: ThemePreviewCardProps) {
  const style = buildPreviewStyle(tokens, ruleStyle) as React.CSSProperties

  return (
    <button
      type="button"
      className="theme-card"
      data-pv-mode={mode}
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
        <span className="theme-card-head">
          <span className="theme-card-heading">Today</span>
          <span className="theme-card-bar">
            <span className="theme-card-bar-fill" />
          </span>
        </span>
        {/* An actual slice of the timeline, with three category blocks and the
            now-line across them - because that is what a person is choosing
            between, and the old miniature (a heading, a line of body copy and
            a chip) could not tell them whether a day would read well in this
            theme. */}
        <span className="theme-card-timeline">
          <span className="theme-card-block" data-cat="core" />
          <span className="theme-card-block" data-cat="meal" />
          <span className="theme-card-now" />
          <span className="theme-card-block" data-cat="health" />
        </span>
        <span className="theme-card-footer">
          <span className="theme-card-row">
            <span className="theme-card-chip" />
            <span className="theme-card-item">Write the proposal</span>
          </span>
          <span className="theme-card-mark">14:20</span>
        </span>
      </span>
      <span className="theme-card-name">{name}</span>
    </button>
  )
}
