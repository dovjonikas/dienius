import { buildPreviewStyle } from '../lib/theme-preview'
import type { ThemePreset } from '../lib/themes'

interface ThemePreviewCardProps {
  preset: ThemePreset
  /** Which variant to render. The caller resolves this - typically via
   * resolveMode against the preset's own `modes` - so a card is never
   * asked to show a mode the preset does not actually ship. */
  mode: 'light' | 'dark'
  selected: boolean
  onSelect: (presetId: string) => void
}

/**
 * One gallery card: a real miniature of the room this preset paints, not a
 * colour swatch. Every value on the card comes from the preset's own
 * `ThemeVariant` through `buildPreviewStyle` - there is no second, hand-
 * guessed copy of what a theme looks like, so a preset can never be
 * previewed as something it is not.
 *
 * The card itself (border, selection ring, footer label) is styled with
 * the app's own live tokens, not the `--pv-*` preview ones - so the
 * gallery's chrome always matches whatever theme is actually active right
 * now, while the room inside each card shows the candidate theme's own
 * colours regardless of which one that is.
 */
export function ThemePreviewCard({ preset, mode, selected, onSelect }: ThemePreviewCardProps) {
  const variant = mode === 'dark' ? preset.dark : preset.light
  if (!variant) return null

  const style = buildPreviewStyle(variant.tokens, variant.ruleStyle) as React.CSSProperties

  return (
    <button
      type="button"
      className="theme-card"
      aria-pressed={selected}
      style={style}
      onClick={() => onSelect(preset.id)}
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
      <span className="theme-card-name">{preset.name}</span>
    </button>
  )
}
