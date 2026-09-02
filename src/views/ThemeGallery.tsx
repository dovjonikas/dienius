import { resolveMode, resolveVariant } from '../lib/theme'
import { PRESETS } from '../lib/themes'
import { useSystemPrefersDark } from '../lib/useSystemPrefersDark'
import { actions, useAppData } from '../lib/store'
import { ThemePreviewCard } from './ThemePreviewCard'

/**
 * The grid of preview cards from docs/THEMES.md section 3. Every preset in
 * `PRESETS` gets a card automatically - adding a thirteenth preset later
 * needs no change here, only a new entry in themes.ts.
 *
 * Each card resolves through the same "preset plus that preset's own
 * override patch" pipeline the live page paints from (resolveVariant, the
 * same function resolveTheme itself uses) rather than reading
 * preset.light/preset.dark directly - so a preset that has been hand-tuned
 * through the override panel is never previewed with its stock colors. A
 * card that lied about the room was exactly the failure docs/THEMES.md was
 * written to prevent.
 */
export function ThemeGallery() {
  const data = useAppData()
  const theme = data.settings.theme
  const prefersDark = useSystemPrefersDark()

  return (
    <div className="theme-gallery" role="group" aria-label="Theme">
      {PRESETS.map(preset => {
        const mode = resolveMode(theme, prefersDark, preset.modes)
        const variant = mode === 'dark' ? preset.dark : preset.light
        if (!variant) return null
        const patch = theme.overrides[preset.id] ?? {}
        const { tokens, ruleStyle } = resolveVariant(variant, patch)
        return (
          <ThemePreviewCard
            key={preset.id}
            name={preset.name}
            tokens={tokens}
            ruleStyle={ruleStyle}
            mode={mode}
            selected={theme.presetId === preset.id}
            onSelect={() => actions.setThemePreset(preset.id)}
          />
        )
      })}
    </div>
  )
}
