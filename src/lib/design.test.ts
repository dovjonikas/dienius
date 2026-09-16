import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { contrastRatio, mixSrgb } from './contrast'
import { FILLS, PRESETS } from './themes'

/**
 * The design system, held to what docs/DESIGN.md says it is.
 *
 * Two kinds of check. The first reads the tokens and the presets and fails on
 * any value that is not the one written down: the scale in fours, the six
 * type sizes, the three line heights and weights, one control height, two
 * corners, 120 and 180ms, and the quiet grounds a control sits on - which are
 * derived with color-mix, so they are mixed here the way the browser mixes
 * them and held to 4.5:1 for text in every preset.
 *
 * The second is a ratchet. The pass that built the system is retiring what
 * came before it a screen group at a time, and each thing being retired is
 * counted here with the number that is left. A count may only go down, and it
 * is lowered in the commit that brings it down: a number that rises is
 * something new built the old way, and a number that falls without the
 * baseline following is a change nobody wrote down.
 */

const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  // Comments become spaces of the same length, so a count never reads prose.
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

/** Every rule as its selector and body, one level deep inside at-rules. */
function rules(): { selector: string; body: string; inside: string }[] {
  const out: { selector: string; body: string; inside: string }[] = []
  const stack: string[] = []
  let buffer = ''
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buffer.trim())
      buffer = ''
    } else if (ch === '}') {
      const selector = stack.pop() ?? ''
      if (!selector.startsWith('@')) {
        out.push({ selector: selector.replace(/\s+/g, ' '), body: buffer, inside: stack.join(' ') })
      }
      buffer = ''
    } else {
      buffer += ch
    }
  }
  return out
}

const ALL = rules()

/** The value a custom property is given in a rule whose selector is exactly this, and not inside any at-rule. */
function tokenIn(selector: string, name: string): string | undefined {
  for (const rule of ALL) {
    if (rule.selector !== selector || rule.inside !== '') continue
    const found = rule.body.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))
    if (found) return found[1].trim()
  }
  return undefined
}

describe('the scales are the ones docs/DESIGN.md writes down', () => {
  test('spacing is in steps of four: 4, 8, 12, 16, 24, 32 and 48', () => {
    const steps = ['--s1', '--s2', '--s3', '--s4', '--s6', '--s8', '--s12'].map(t => tokenIn(':root', t))
    expect(steps).toEqual(['4px', '8px', '12px', '16px', '24px', '32px', '48px'])
    // Density takes the whole scale to three quarters, the new step with it.
    expect(tokenIn(":root[data-density='compact']", '--s12')).toBe('36px')
  })

  test('type is six sizes, three line heights and three weights', () => {
    const sizes = ['--t-xs', '--t-sm', '--t-md', '--t-read', '--t-lg', '--t-xl'].map(t => tokenIn(':root', t))
    expect(sizes).toEqual(['11px', '13px', '15px', '17px', '20px', '34px'])
    expect(['--lh-tight', '--lh-ui', '--lh-read'].map(t => tokenIn(':root', t))).toEqual(['1.25', '1.4', '1.6'])
    expect(['--w-regular', '--w-medium', '--w-strong'].map(t => tokenIn(':root', t))).toEqual(['400', '500', '600'])
    // The text size setting scales the reading step with the rest.
    expect(tokenIn(":root[data-text-scale='s']", '--t-read')).toBe('16px')
    expect(tokenIn(":root[data-text-scale='l']", '--t-read')).toBe('19px')
  })

  test('every control is one height: 36px, 32px at compact density, the touch target on a finger', () => {
    expect(tokenIn(':root', '--control-h')).toBe('36px')
    expect(tokenIn(":root[data-density='compact']", '--control-h')).toBe('32px')
    const coarse = ALL.find(r => r.inside.includes('pointer: coarse') && /--control-h\s*:\s*var\(--touch\)/.test(r.body))
    expect(coarse?.selector).toBe(":root, :root[data-density='compact']")
  })

  test('a page is one of two widths', () => {
    expect(tokenIn(':root', '--page-w')).toBe('840px')
    expect(tokenIn(':root', '--read-w')).toBe('640px')
  })

  test('two corners and a shape: 6px, and 10px for every control and every card in every preset', () => {
    expect(tokenIn(':root', '--r-mark')).toBe('6px')
    expect(tokenIn(':root', '--r-control')).toBe('var(--radius)')
    expect(tokenIn(':root', '--r-card')).toBe('var(--edge)')
    for (const preset of PRESETS) {
      for (const mode of preset.modes) {
        const tokens = (mode === 'light' ? preset.light : preset.dark)!.tokens
        expect([preset.id, tokens.radius, tokens.edge]).toEqual([preset.id, '10px', '10px'])
      }
    }
  })

  test('motion answers in 120ms and arrives in 180ms, easing out', () => {
    expect(tokenIn(':root', '--dur-fast')).toBe('120ms')
    expect(tokenIn(':root', '--dur')).toBe('180ms')
    expect(tokenIn(':root', '--ease')).toBe('cubic-bezier(0.2, 0, 0, 1)')
  })
})

describe('the quiet grounds', () => {
  const percent = (p: number) => `${Math.round(p * 100)}%`

  test('the stylesheet mixes the fills the way FILLS says', () => {
    const dark = FILLS.dark
    expect(tokenIn(':root', '--fill')).toBe(`color-mix(in srgb, var(--text) ${percent(dark.fill)}, var(--${dark.over}))`)
    expect(tokenIn(':root', '--fill-strong')).toBe(`color-mix(in srgb, var(--text) ${percent(dark.strong)}, var(--${dark.over}))`)
    const light = FILLS.light
    expect(tokenIn(":root[data-theme='light']", '--fill')).toBe(`color-mix(in srgb, var(--text) ${percent(light.fill)}, var(--${light.over}))`)
    expect(tokenIn(":root[data-theme='light']", '--fill-strong')).toBe(`color-mix(in srgb, var(--text) ${percent(light.strong)}, var(--${light.over}))`)
  })

  test('one scrim per mode, and a focus halo', () => {
    expect(tokenIn(':root', '--scrim')).toBeDefined()
    expect(tokenIn(":root[data-theme='light']", '--scrim')).toBeDefined()
    expect(tokenIn(':root', '--ring')).toBe('color-mix(in srgb, var(--accent) 40%, transparent)')
  })

  for (const preset of PRESETS) {
    for (const mode of preset.modes) {
      const tokens = (mode === 'light' ? preset.light : preset.dark)!.tokens
      const mix = FILLS[mode]
      const ground = tokens[mix.over]
      const fill = mixSrgb(tokens.text, ground, mix.fill)
      const strong = mixSrgb(tokens.text, ground, mix.strong)

      test(`${preset.name} (${mode}): text and secondary text read at 4.5:1 on both fills, the accent at 3:1`, () => {
        for (const [name, on] of [['fill', fill], ['strong fill', strong]] as const) {
          expect(contrastRatio(tokens.text, on), `text on the ${name}`).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(tokens.muted, on), `secondary text on the ${name}`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrastRatio(tokens.accent, fill), 'the accent on the fill').toBeGreaterThanOrEqual(3)
      })

      test(`${preset.name} (${mode}): a field on the page and a field on a card can both be seen`, () => {
        // Not a contrast rule for text - a ground only has to be told apart
        // from the one it stands on, and 1.05:1 is about where two greys stop
        // being the same grey.
        expect(contrastRatio(fill, tokens.bg), 'the fill against the page').toBeGreaterThanOrEqual(1.05)
        expect(contrastRatio(fill, tokens.surface), 'the fill against a card').toBeGreaterThanOrEqual(1.05)
      })
    }
  }
})

// --- the ratchet --------------------------------------------------------

const count = (re: RegExp) => (css.match(re) ?? []).length

const drawnBorders = () =>
  [...css.matchAll(/(?:^|[{;\s])border(?:-(?:top|right|bottom|left))?\s*:\s*([^;}]+)/g)]
    .map(m => m[1].trim())
    .filter(v => !/^(none|0)$/.test(v) && !/\btransparent\b/.test(v)).length

const pressesThatScale = () =>
  ALL.filter(r => r.selector.includes(':active') && /transform\s*:[^;]*scale\(/.test(r.body)).length

/**
 * What is left of each retired thing. Lower a number in the commit that
 * brings it down; never raise one.
 */
const RETIRED: { what: string; now: () => number; left: number }[] = [
  { what: 'uses of --s5 (20px)', now: () => count(/var\(--s5\)/g), left: 13 },
  { what: 'uses of --s7 (28px)', now: () => count(/var\(--s7\)/g), left: 2 },
  { what: 'uses of --t-2xs (10px)', now: () => count(/var\(--t-2xs\)/g), left: 10 },
  { what: 'uses of --t-input (16px)', now: () => count(/var\(--t-input\)/g), left: 7 },
  { what: 'uses of --e1, a resting shadow', now: () => count(/var\(--e1\)/g), left: 6 },
  { what: 'font weights written as numbers', now: () => count(/font-weight\s*:\s*[0-9]+/g), left: 83 },
  {
    what: 'line heights written as numbers',
    now: () => count(/line-height\s*:\s*(?!1\s*[;}\s]|inherit|normal|var\()[0-9.]+(px)?/g),
    left: 79,
  },
  { what: 'tracked capitals', now: () => count(/text-transform\s*:\s*uppercase/g), left: 20 },
  { what: 'borders drawn', now: drawnBorders, left: 120 },
  { what: 'black written as rgba()', now: () => count(/rgba\(0,\s*0,\s*0,/g), left: 8 },
  { what: 'presses that scale', now: pressesThatScale, left: 0 },
  { what: 'heights written as min-height in pixels', now: () => count(/min-height\s*:\s*[0-9]+px/g), left: 64 },
]

describe('what the design pass is retiring only goes down', () => {
  for (const item of RETIRED) {
    test(item.what, () => {
      const now = item.now()
      expect(now, `${item.what}: ${now} now, ${item.left} written down - ${now > item.left ? 'something new was built the old way' : 'lower the number in design.test.ts to ' + now}`).toBe(item.left)
    })
  }
})
