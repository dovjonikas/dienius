import { actions, useAppData } from '../lib/store'
import { findPreset } from '../lib/themes'

/**
 * The accents on offer. Eight, curated, and no colour picker.
 *
 * The panel this replaces let a person set any of twenty-one theme tokens to
 * any value they could type, which is a theming engine rather than a setting -
 * it could produce text the same colour as the paper, needed a live contrast
 * warning and a Reset button to dig out of, and nobody used it twice. What
 * people actually want from a theme is "not blue", and eight answers to that
 * is generous.
 *
 * Every one of these is picked to sit at or above 4.5:1 against the card
 * surface of all three themes, so no combination reachable here can produce
 * something unreadable - which is why the contrast warning that used to live
 * beside the old panel is gone rather than merely hidden.
 */
const ACCENTS: { id: string; label: string; value: string }[] = [
  { id: 'default', label: 'Default', value: '' },
  { id: 'indigo', label: 'Indigo', value: '#8aa4f2' },
  { id: 'teal', label: 'Teal', value: '#5fb3b8' },
  { id: 'green', label: 'Green', value: '#7bbf8c' },
  { id: 'amber', label: 'Amber', value: '#dfae64' },
  { id: 'coral', label: 'Coral', value: '#e59183' },
  { id: 'rose', label: 'Rose', value: '#dd8fb4' },
  { id: 'violet', label: 'Violet', value: '#a992e0' },
]

const DENSITIES: { id: 'comfortable' | 'compact'; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
]

const TEXT_SCALES: { id: 's' | 'm' | 'l'; label: string; hint: string }[] = [
  { id: 's', label: 'S', hint: 'Small text' },
  { id: 'm', label: 'M', hint: 'Medium text' },
  { id: 'l', label: 'L', hint: 'Large text' },
]

/**
 * Three settings that adjust any of the three themes without replacing it:
 * what colour the app points with, how much air it spends, and how big it
 * reads. All three work identically on Dark, Light and Midnight.
 *
 * Accent is stored as a per-theme override patch, the same mechanism a preset
 * has always been tunable through - so picking coral on Dark and leaving Light
 * alone is remembered separately for each, which is what somebody who uses one
 * by day and the other by night actually wants. Density and text scale are
 * not: they are facts about the screen and the eyes in front of it, and it
 * would be strange for either to change when the sun goes down, so they live
 * in settings beside the other app-wide switches.
 */
export function AppearanceControls() {
  const data = useAppData()
  const theme = data.settings.theme
  const presetId = findPreset(theme.presetId).id
  const currentAccent = theme.overrides[presetId]?.accent ?? ''

  function pickAccent(value: string) {
    if (value === '') actions.unsetThemeOverride(presetId, 'accent')
    else actions.setThemeOverride(presetId, 'accent', value)
  }

  return (
    <>
      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Accent colour</span>
          <span className="setting-desc">
            What the app points with - the progress bar, focus rings, the ring on a running task.
            Remembered per theme.
          </span>
        </div>
        <div className="setting-control">
          <div className="accent-picker" role="group" aria-label="Accent colour">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                type="button"
                className={a.value === currentAccent ? 'accent-swatch selected' : 'accent-swatch'}
                style={a.value ? ({ ['--swatch' as string]: a.value } as React.CSSProperties) : undefined}
                data-accent={a.id}
                aria-pressed={a.value === currentAccent}
                aria-label={a.label}
                title={a.label}
                onClick={() => pickAccent(a.value)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Density</span>
          <span className="setting-desc">
            Compact tightens the spacing scale everywhere at once. Useful on a short laptop screen,
            where it is the difference between a full day fitting and not.
          </span>
        </div>
        <div className="setting-control">
          <div className="segmented" role="group" aria-label="Density">
            {DENSITIES.map(d => (
              <button
                key={d.id}
                type="button"
                className={data.settings.density === d.id ? 'active' : ''}
                aria-pressed={data.settings.density === d.id}
                onClick={() => actions.setDensity(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Text size</span>
          <span className="setting-desc">
            Scales the whole type system together, so the difference between a title and the line
            under it stays exactly the same at every size.
          </span>
        </div>
        <div className="setting-control">
          <div className="segmented" role="group" aria-label="Text size">
            {TEXT_SCALES.map(t => (
              <button
                key={t.id}
                type="button"
                className={data.settings.textScale === t.id ? 'active' : ''}
                aria-pressed={data.settings.textScale === t.id}
                aria-label={t.hint}
                onClick={() => actions.setTextScale(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
