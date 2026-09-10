import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * The stylesheet keeps to two scales - CONVENTIONS section 5 - and this
 * reads it as text to hold it there, the way stacking.test.ts holds every
 * contained rule to a z-index and gridAreas.test.ts holds every area name
 * to a template.
 *
 * Type is the steps on `:root` (`--t-2xs` to `--t-xl`, and the two fluid
 * sizes the Focus screen uses) plus the input floor and the glyph size,
 * and a rule says which with a token. Spacing is `--s0` to `--s8`, and
 * every padding, margin and gap is a token, or one of the few pixel values
 * the scale has no step for: a hairline, and the 3px and 6px half-steps
 * inside the smallest boxes the app draws. A literal off both lists is what
 * the owner's screenshots kept finding - 14px here, 9px there, a 13px field
 * beside a 12px one - and it is a defect, not a choice. The tokens are also
 * what density redefines, so a literal that happens to equal a token is a
 * value density cannot reach.
 *
 * One door is left for geometry: a pixel amount inside a `calc()` that
 * also carries a token - the 32px close button the sheet's title keeps
 * clear of, the 18px chevron a select paints over its own padding. Those
 * name a size the scale has no step for, beside the step they add to; a
 * bare literal never does.
 */

const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  // Comments become spaces of the same length so line numbers hold.
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

/** Every `prop: value;` declaration with its line, for the props asked for. */
function declarations(props: string[]): { line: number; prop: string; value: string }[] {
  const out: { line: number; prop: string; value: string }[] = []
  const lines = css.split('\n')
  // Anywhere on the line, not only at its start: a one-line rule holds its
  // declarations after the brace, and reading the first column alone let a
  // handful of literals live on for a version inside `h2 { ... margin: 8px
  // 0 16px; }` and its kind.
  const wanted = new RegExp(`(?:^|[{;])\\s*(${props.join('|')})\\s*:\\s*([^;}]+)`, 'g')
  lines.forEach((text, i) => {
    for (const m of text.matchAll(wanted)) out.push({ line: i + 1, prop: m[1], value: m[2].trim() })
  })
  return out
}

/** The pixel literals in a value. */
function pixels(value: string): number[] {
  return [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(m => Math.abs(Number(m[1])))
}

/**
 * The pixel literals that stand bare. In a value that carries a token,
 * whatever sits inside a function beside it is geometry and is let through;
 * in a value with no token at all, every literal is bare - a `max(56px, ...)`
 * with nothing named in it is a number nobody can find again.
 */
function barePixels(value: string): number[] {
  if (!/var\(--/.test(value)) return pixels(value)
  let v = value
  let previous: string
  do {
    previous = v
    v = v.replace(/\([^()]*\)/g, '')
  } while (v !== previous)
  return pixels(v)
}

test('every font-size is a step of the type scale, said as a token', () => {
  // The declarations of the scale itself, on :root and under the density
  // and text-size attributes, are custom properties and not font-size, so
  // they are the one place a pixel size is written.
  const literal = declarations(['font-size']).filter(d => /\d/.test(d.value) && !/var\(--t-/.test(d.value) && d.value !== '0')
  expect(literal.map(d => `L${d.line} font-size: ${d.value}`)).toEqual([])
})

// The spacing scale has no step for these, and each has a place: 1px is a
// hairline, 3px and 6px are the half-steps inside a week block, a chip and
// a timeline block, where 4 and 8 are too much room for the box.
const SPACING_ALLOWED = new Set([0, 1, 3, 6])

test('every padding, margin and gap is a spacing token, or a hairline or half-step', () => {
  const props = [
    'padding',
    'margin',
    'gap',
    'row-gap',
    'column-gap',
    'padding-(?:top|right|bottom|left|inline|block)',
    'margin-(?:top|right|bottom|left|inline|block)',
  ]
  const offenders = declarations(props).flatMap(d =>
    barePixels(d.value)
      // A fraction of a pixel is drawing, not a gap: the clock face's hands
      // are centred by three quarters of one.
      .filter(px => !SPACING_ALLOWED.has(px) && px >= 1)
      .map(px => `L${d.line} ${d.prop}: ${d.value} (${px}px)`),
  )
  expect(offenders).toEqual([])
})

// --- a class excluded from the base rule still says what colour it is ----

/**
 * The base input rule excludes some inputs by class, so a control that
 * draws its own box does not get a second one - see the comment on it. An
 * exclusion takes away the border, the padding and the background, and it
 * also takes away `color`, which is not a box: it is whether the text can
 * be read at all.
 *
 * It did. `.time-input` was excluded in v2.5 to fix the stepper being a box
 * inside a box, and every time picker in the app - Settings' evening and
 * both sleep windows, the task detail, the template editor - fell through
 * to the browser's own black on a dark surface, at 1.14:1. Nothing caught
 * it: a field's text is its value, and the sweep's contrast pass walked
 * text nodes, which an input has none of. The sweep reads a field's value
 * now, and this holds the same line without needing a build.
 *
 * So: every class named in a `:not(.x)` on the base input rule must have a
 * rule of its own that gives it a colour.
 */
test('every input class excluded from the base rule sets its own colour', () => {
  const base = css.split(String.fromCharCode(10)).find(l => l.startsWith('input:not(') && l.includes("[type='checkbox']"))
  expect(base).toBeDefined()

  const excluded = [...(base as string).matchAll(/:not\(\.([a-z-]+)\)/g)].map(m => m[1])
  expect(excluded.length).toBeGreaterThan(0)

  // Each rule as selector + body, which is enough here: a nested block's
  // inner rules still come out whole when split on a closing brace.
  const rules = css.split(String.fromCharCode(10)).join(' ').split('}')

  for (const cls of excluded) {
    const owns = rules.some(rule => {
      const brace = rule.indexOf('{')
      if (brace < 0) return false
      const selectors = rule.slice(0, brace).split(',').map(sel => sel.trim())
      return selectors.includes('.' + cls) && rule.slice(brace).includes('color:')
    })
    expect(owns, cls + ' is excluded from the base input rule and no rule gives it a colour').toBe(true)
  }
})

// --- and one corner scale, said in tokens --------------------------------

/**
 * Every corner in the app is one of three steps or one of two shapes, and
 * none of them is a number written at the point of use.
 *
 * The night pass counted fourteen distinct border-radius values, of which
 * two were bare literals - `1px` on five bars and `3px` on four blocks -
 * doing the job the smallest step already had a token for. A literal corner
 * is a corner a theme cannot reach: `--r-control` and `--r-card` are the
 * preset's own `--radius` and `--edge`, so a preset with a hand-drawn edge
 * changes every card and leaves the nine hard-coded ones square.
 *
 * The steps go by the size of the thing rather than by its role, which is
 * why there are three and not the two the brief asked for: an 18px checkbox
 * and a 38px button cannot share a corner. See the block on `--r-mark` in
 * the stylesheet, and DECISIONS.
 */
test('every corner is a radius token, or nothing', () => {
  const offenders = declarations(['border-radius', 'border-[a-z]+-radius'])
    // The tokens' own definitions are custom properties, not border-radius,
    // so this never sees the one place a corner is written as a number.
    .filter(d => {
      const bare = d.value
        .replace(/var\(--(?:r-[a-z]+|pv-edge)\)/g, '')
        .replace(/[0-9]+%/g, '')
        .replace(/\binherit\b/g, '')
        .replace(/[\s/]|(?<![\w.])0(?![\w.])/g, '')
      return bare !== ''
    })
    .map(d => `L${d.line} ${d.prop}: ${d.value}`)
  expect(offenders).toEqual([])
})
