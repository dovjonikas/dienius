import { useEffect, useState } from 'react'
import { resolveMode, systemPrefersDark } from '../lib/theme'
import { PRESETS } from '../lib/themes'
import { actions, useAppData } from '../lib/store'
import { ThemePreviewCard } from './ThemePreviewCard'

/**
 * Tracks the live `prefers-color-scheme` result, the same way App.tsx's own
 * theme effect does, so a preset previewed while mode is 'system' shows
 * the variant that would actually paint right now rather than whatever it
 * was when the gallery first mounted. Wrapped in the same try/catch for
 * the same reason - matchMedia is not guaranteed to exist everywhere this
 * runs (jsdom in tests included, where it throws and this simply keeps the
 * initial systemPrefersDark() reading of false).
 */
function useLiveSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(systemPrefersDark)

  useEffect(() => {
    try {
      const query = window.matchMedia('(prefers-color-scheme: dark)')
      const update = () => setDark(query.matches)
      update()
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    } catch {
      return undefined
    }
  }, [])

  return dark
}

/**
 * The grid of preview cards from docs/THEMES.md section 3. Every preset in
 * `PRESETS` gets a card automatically - adding a thirteenth preset later
 * needs no change here, only a new entry in themes.ts.
 */
export function ThemeGallery() {
  const data = useAppData()
  const theme = data.settings.theme
  const prefersDark = useLiveSystemPrefersDark()

  return (
    <div className="theme-gallery" role="group" aria-label="Theme">
      {PRESETS.map(preset => {
        const mode = resolveMode(theme, prefersDark, preset.modes)
        return (
          <ThemePreviewCard
            key={preset.id}
            preset={preset}
            mode={mode}
            selected={theme.presetId === preset.id}
            onSelect={actions.setThemePreset}
          />
        )
      })}
    </div>
  )
}
