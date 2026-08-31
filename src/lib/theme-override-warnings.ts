/**
 * Contrast warnings for the override panel.
 *
 * docs/THEMES.md section 7's contrast gate (theme-contrast.test.ts) runs at
 * merge time over the fixed preset array - it keeps a *shipped* preset
 * honest, and has no way to see a value a person picks by hand at runtime.
 * Once the override panel lets someone set an arbitrary accent or text
 * color, silently allowing an unreadable combination would contradict "text
 * must always look professional and stay highly readable"; hard-blocking
 * the color picker would contradict the app being genuinely his to shape.
 * This module is the middle path: the same thresholds the merge-time gate
 * uses, surfaced as an honest, non-blocking warning the moment a choice
 * would fail them.
 */
import { contrastRatio } from './contrast'
import type { ThemeTokens } from './themes'

export const MIN_TEXT_CONTRAST = 4.5
export const MIN_ACCENT_CONTRAST = 3

export interface ContrastWarning {
  message: string
}

const GROUNDS: { name: string; token: keyof ThemeTokens }[] = [
  { name: 'the paper', token: 'bg' },
  { name: 'cards', token: 'surface' },
]

/**
 * Checks the same two pairs theme-contrast.test.ts checks for every shipped
 * preset - body text against both grounds at 4.5:1, accent against both
 * grounds at 3:1 - against whatever the panel currently resolves to. Never
 * throws: a color a person is still in the middle of typing, or a bad value
 * from a hand-edited backup, is skipped rather than crashing the panel.
 */
export function contrastWarnings(tokens: ThemeTokens): ContrastWarning[] {
  const warnings: ContrastWarning[] = []
  for (const ground of GROUNDS) {
    const groundColor = tokens[ground.token]

    const textRatio = safeContrast(tokens.text, groundColor)
    if (textRatio !== null && textRatio < MIN_TEXT_CONTRAST) {
      warnings.push({
        message: `Text is hard to read against ${ground.name} (${textRatio.toFixed(1)}:1, needs ${MIN_TEXT_CONTRAST}:1).`,
      })
    }

    const accentRatio = safeContrast(tokens.accent, groundColor)
    if (accentRatio !== null && accentRatio < MIN_ACCENT_CONTRAST) {
      warnings.push({
        message: `Accent is hard to see against ${ground.name} (${accentRatio.toFixed(1)}:1, needs ${MIN_ACCENT_CONTRAST}:1).`,
      })
    }
  }
  return warnings
}

function safeContrast(a: string, b: string): number | null {
  try {
    return contrastRatio(a, b)
  } catch {
    return null
  }
}
