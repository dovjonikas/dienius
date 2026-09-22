import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { contrastRatio, mixSrgb } from './contrast'
import { FILLS, PRESETS } from './themes'

/**
 * The design system, held to what docs/DESIGN.md says it is.
 *
 * Two kinds of check. The first reads the tokens and the presets and fails on
 * any value that is not the one written down: the scale in fours with no
 * pixel written beside it, the five type sizes, the three line heights and
 * weights, one control height, one corner, 120 and 180ms, and the quiet
 * grounds a control sits on - which are
 * derived with color-mix, so they are mixed here the way the browser mixes
 * them and held to 4.5:1 for text in every preset.
 *
 * The second is a ratchet. The pass that built the system retired what came
 * before it a screen group at a time, and each thing it retired is counted
 * here with the number that is left - most of them none, and the rest kept
 * on purpose and listed in docs/DESIGN-AUDIT.md. A count may only go down,
 * and it is lowered in the commit that brings it down: a number that rises
 * is something new built the old way, and a number that falls without the
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
    // Compact is one step tighter on the same grid, never off it.
    const compact = ['--s1', '--s2', '--s3', '--s4', '--s6', '--s8', '--s12'].map(t => tokenIn(":root[data-density='compact']", t))
    expect(compact).toEqual(['4px', '4px', '8px', '12px', '16px', '24px', '32px'])
    // No half step is declared at all.
    expect(css).not.toMatch(/--s0\s*:/)
  })

  // One look, rule 1 - docs/DESIGN.md: every margin, padding and gap is a
  // token of the scale, and no spacing declaration writes a number of pixels.
  test('no margin, padding or gap is written in pixels: every one is a step of the scale', () => {
    const SPACING = /(?:^|[;{\s])((?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g
    const raw: string[] = []
    for (const rule of ALL) {
      for (const m of rule.body.matchAll(SPACING)) {
        if (/(?<![\w-])-?\d*\.?\d+px/.test(m[2])) raw.push(`${rule.selector} { ${m[1]}: ${m[2].trim()} }`)
      }
    }
    expect(raw).toEqual([])
  })

  // One look, rule 3: five type sizes in the whole app.
  test('type is five sizes, three line heights and three weights', () => {
    const sizes = ['--t-xs', '--t-sm', '--t-md', '--t-lg', '--t-xl'].map(t => tokenIn(':root', t))
    expect(sizes).toEqual(['11px', '13px', '16px', '20px', '40px'])
    // The reading step is the body step, never under the 16px a field on a finger needs.
    expect(tokenIn(':root', '--t-read')).toBe('max(16px, var(--t-md))')
    // And the three that were sizes of their own are steps of the five.
    expect(['--t-focus', '--t-focus-title', '--t-glyph'].map(t => tokenIn(':root', t))).toEqual(['var(--t-xl)', 'var(--t-lg)', 'var(--t-lg)'])
    expect(['--lh-tight', '--lh-ui', '--lh-read'].map(t => tokenIn(':root', t))).toEqual(['1.25', '1.4', '1.6'])
    expect(['--w-regular', '--w-medium', '--w-strong'].map(t => tokenIn(':root', t))).toEqual(['400', '500', '600'])
    // The text size setting scales the five together.
    expect(['--t-xs', '--t-sm', '--t-md', '--t-lg', '--t-xl'].map(t => tokenIn(":root[data-text-scale='s']", t))).toEqual(['10px', '12px', '15px', '18px', '36px'])
    expect(['--t-xs', '--t-sm', '--t-md', '--t-lg', '--t-xl'].map(t => tokenIn(":root[data-text-scale='l']", t))).toEqual(['12px', '14.5px', '18px', '23px', '44px'])
    // No font size is written as a number outside the tokens.
    const written = ALL.filter(r => r.inside === '' || !r.selector.startsWith(':root')).flatMap(r => [...r.body.matchAll(/font-size\s*:\s*([^;]+)/g)].map(m => m[1].trim())).filter(v => /\d+(\.\d+)?(px|rem|em)\b/.test(v) && !v.startsWith('max(16px'))
    expect(written).toEqual([])
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

  // One look, rule 3: one corner for everything, and the circle as a shape.
  test('one corner: 8px for a mark, a control, a chip and a card, in every preset', () => {
    expect(tokenIn(':root', '--r')).toBe('8px')
    for (const name of ['--r-mark', '--r-control', '--r-card', '--r-pill']) expect([name, tokenIn(':root', name)]).toEqual([name, 'var(--r)'])
    expect(tokenIn(':root', '--r-round')).toBe('50%')
    for (const preset of PRESETS) {
      for (const mode of preset.modes) {
        const tokens = (mode === 'light' ? preset.light : preset.dark)!.tokens
        expect([preset.id, tokens.radius, tokens.edge]).toEqual([preset.id, '8px', '8px'])
      }
    }
    // No corner is written as a number of its own.
    const written = ALL.flatMap(r => [...r.body.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;]+)/g)].map(m => `${r.selector} ${m[1].trim()}`)).filter(v => /(?<![\w-])[1-9]\d*(\.\d+)?px/.test(v))
    expect(written).toEqual([])
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

  // The layers' own fills: the :is() rule after .task-detail's --ground.
  const fillRules = (prefix: string) =>
    ALL.filter(r => r.inside === '' && r.selector.startsWith(prefix) && /(?:^|;)\s*--fill\s*:/.test(r.body))
  const valueIn = (body: string, name: string) =>
    body.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1].trim()
  const listed = (selector: string) =>
    selector.slice(selector.indexOf('(') + 1, selector.lastIndexOf(')')).split(',').map(s => s.trim())

  test("on a layer a dark theme mixes the fills over the raised ground, and the light theme keeps the page's", () => {
    const dark = fillRules(':is(')
    const light = fillRules(":root[data-theme='light'] :is(")
    expect(dark).toHaveLength(1)
    expect(light).toHaveLength(1)
    const mix = FILLS.darkLayer
    expect(valueIn(dark[0].body, '--fill')).toBe(`color-mix(in srgb, var(--text) ${percent(mix.fill)}, var(--surface-raised))`)
    expect(valueIn(dark[0].body, '--fill-strong')).toBe(`color-mix(in srgb, var(--text) ${percent(mix.strong)}, var(--surface-raised))`)
    expect(valueIn(light[0].body, '--fill')).toBe(tokenIn(":root[data-theme='light']", '--fill'))
    expect(valueIn(light[0].body, '--fill-strong')).toBe(tokenIn(":root[data-theme='light']", '--fill-strong'))
    expect(listed(light[0].selector)).toEqual(listed(dark[0].selector))
    // And the chosen segment's ground follows the fills it is one of.
    expect(valueIn(dark[0].body, '--thumb')).toBe(tokenIn(':root', '--thumb'))
    expect(valueIn(light[0].body, '--thumb')).toBe(tokenIn(":root[data-theme='light']", '--thumb'))
  })

  test('everything painted on the raised ground is one of those layers', () => {
    const layers = listed(fillRules(':is(')[0].selector)
    const raised = ALL.filter(r => /background(?:-color)?\s*:\s*var\(--surface-raised/.test(r.body)).flatMap(r =>
      r.selector.split(',').map(s => s.trim()),
    )
    expect(raised.length).toBeGreaterThan(20)
    for (const selector of raised) {
      // A state of a layer, or a part of one, still stands on that layer.
      expect(layers.some(layer => selector === layer || selector.startsWith(layer)), selector).toBe(true)
    }
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

      if (mode === 'dark') {
        const layer = FILLS.darkLayer
        const raised = tokens[layer.over]
        const layerFill = mixSrgb(tokens.text, raised, layer.fill)
        const layerStrong = mixSrgb(tokens.text, raised, layer.strong)

        test(`${preset.name} (dark): on a layer, text and secondary text read at 4.5:1 on both fills, and a fill can be told from the layer`, () => {
          for (const [name, on] of [['fill', layerFill], ['strong fill', layerStrong]] as const) {
            expect(contrastRatio(tokens.text, on), `text on a layer's ${name}`).toBeGreaterThanOrEqual(4.5)
            expect(contrastRatio(tokens.muted, on), `secondary text on a layer's ${name}`).toBeGreaterThanOrEqual(4.5)
          }
          expect(contrastRatio(tokens.accent, layerFill), "the accent on a layer's fill").toBeGreaterThanOrEqual(3)
          expect(contrastRatio(layerFill, raised), 'the fill against the layer').toBeGreaterThanOrEqual(1.05)
        })
      }

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
  // The retired steps and tokens are not only unused: they are not declared,
  // so a rule naming one is thrown away whole by the browser - see the
  // spacing tokens in styles.css - and fails here first.
  {
    what: 'the retired --s5, --s7, --t-2xs, --t-input and --e1, declared or named',
    now: () => count(/--(?:s5|s7|t-2xs|t-input|e1)\b/g),
    left: 0,
  },
  { what: 'font weights written as numbers', now: () => count(/font-weight\s*:\s*[0-9]+/g), left: 0 },
  {
    what: 'line heights written as numbers',
    now: () => count(/line-height\s*:\s*(?!1\s*[;}\s]|inherit|normal|var\()[0-9.]+(px)?/g),
    left: 5,
  },
  { what: 'tracked capitals', now: () => count(/text-transform\s*:\s*uppercase/g), left: 0 },
  { what: 'borders drawn', now: drawnBorders, left: 47 },
  { what: 'black written as rgba()', now: () => count(/rgba\(0,\s*0,\s*0,/g), left: 7 },
  { what: 'presses that scale', now: pressesThatScale, left: 0 },
  { what: 'heights written as min-height in pixels', now: () => count(/min-height\s*:\s*[0-9]+px/g), left: 20 },
]

describe('what the design pass is retiring only goes down', () => {
  for (const item of RETIRED) {
    test(item.what, () => {
      const now = item.now()
      expect(now, `${item.what}: ${now} now, ${item.left} written down - ${now > item.left ? 'something new was built the old way' : 'lower the number in design.test.ts to ' + now}`).toBe(item.left)
    })
  }
})
