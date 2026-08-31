import type { ThemeState } from '../lib/types'

interface ThemeModeControlProps {
  mode: ThemeState['mode']
  /** Which light/dark variants the currently active preset actually
   * ships - a preset that only ships one, per docs/THEMES.md section 4,
   * disables the other rather than offering a broken variant. */
  availableModes: ('light' | 'dark')[]
  onChange: (mode: ThemeState['mode']) => void
}

const OPTIONS: { value: ThemeState['mode']; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/**
 * Mode is separate from preset: the gallery picks the room, this says
 * whether the light is on. 'system' is never disabled - it always resolves
 * to whichever mode the active preset actually ships (see resolveMode in
 * theme.ts), so it is never a broken choice even for a one-mode preset.
 */
export function ThemeModeControl({ mode, availableModes, onChange }: ThemeModeControlProps) {
  return (
    <div className="segmented" role="group" aria-label="Light or dark">
      {OPTIONS.map(option => {
        const unavailable = option.value !== 'system' && !availableModes.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            className={mode === option.value ? 'active' : ''}
            aria-pressed={mode === option.value}
            disabled={unavailable}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
