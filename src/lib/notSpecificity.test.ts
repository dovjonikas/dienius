import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * A chain of `:not()`s is a specificity ratchet, and this stylesheet has been
 * caught by it twice.
 *
 * `:not(.x)` contributes its argument's specificity. `:not(:where(.x))`
 * contributes none. So every exclusion added to a selector to keep one more
 * control out of a generic rule quietly raises that rule's score, and the day
 * it climbs past a rule further down the file, the thing that rule was
 * painting stops being painted.
 *
 * The v2.17 case, in full, because it is the argument for this test existing:
 * `.block-add button:not(.category-swatch):not(.time-picker-option)` sat at
 * 0,3,1, tied with `.block-add button[aria-pressed='true']:not(...)`, and won
 * the tie by being earlier - which is to say it lost, and the chosen control
 * kept its accent. A fourth exclusion took it to 0,4,1, the tie became a win,
 * and every chosen control in the add row was painted the page's ground.
 * On a phone that meant the seven day switches all looked the same and
 * nothing said which days a block was about to land on - word for word the
 * defect the comment above those rules says was fixed in v2.12.
 *
 * Nothing could see it. jsdom has no cascade, the sweep's chosen-looks-
 * unchosen pass only reaches a screen it opens, and reading the stylesheet
 * tells you nothing unless you are counting :not()s. So: count them.
 *
 * Two is the line rather than one. A single exclusion is how most of these
 * rules are written and it reads clearly; a third is where the arithmetic
 * stops being obvious to the person adding it, and `:where()` costs nothing
 * to use instead.
 */
const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Every selector in the sheet, one per comma-separated part. */
function selectors(): string[] {
  const out: string[] = []
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const head = m[1].trim().split('\n').at(-1)!.trim()
    if (!head || head.startsWith('@') || head.startsWith('from') || head.startsWith('to')) continue
    for (const part of head.split(',')) out.push(part.trim())
  }
  return out.filter(Boolean)
}

/** The `:not()`s that carry weight - the ones not wrapped in `:where()`. */
function weightedNots(selector: string): number {
  return [...selector.matchAll(/:not\(\s*([^)]*)\)/g)].filter(m => !m[1].trim().startsWith(':where(')).length
}

/**
 * The one selector allowed past the line, with its reason.
 *
 * The base field rule excludes five input types and the time input, which
 * puts it at 0,5,1 - and things in this sheet now rely on it being that
 * high. It is a known trap, written down in the project's working notes: a
 * field made boxless by a class stays boxed, because one class cannot reach
 * it. Converting it to `:where()` would drop it to 0,0,1 and hand the win to
 * every single-class rule in the file at once, which is a change to make
 * deliberately and measure, not one to fold into a layout wave. In
 * BACKLOG.md.
 */
const ALLOWED = [/^input:not\(\[type=.checkbox.\]\)/]

test('no selector stacks more than two weighted :not()s, because each one is a specificity step', () => {
  const offenders = selectors()
    .filter(s => weightedNots(s) > 2)
    .filter(s => !ALLOWED.some(allowed => allowed.test(s)))
    .map(s => s.slice(0, 120))
  expect(offenders).toEqual([])
})

/**
 * And the one pair the ratchet actually broke, named so a future change to
 * either side fails here rather than on a phone: the rule that paints a
 * chosen control in the add row must stay at least as specific as the
 * generic one that paints every button in it.
 */
test('the add row paints its chosen control after painting its plain ones', () => {
  const all = selectors()
  const generic = all.find(s => /^\.block-add button:not\(/.test(s) && !s.includes('aria-pressed'))
  const pressed = all.find(s => s.includes('.block-add button[aria-pressed'))
  expect(generic, 'the generic add-row button rule').toBeTruthy()
  expect(pressed, 'the chosen add-row button rule').toBeTruthy()
  // The generic one carries its exclusions weightlessly, so the pressed rule
  // - which has a real attribute selector in it - is the more specific of
  // the two and paints last.
  expect(weightedNots(generic!)).toBe(0)
  expect(weightedNots(pressed!)).toBeLessThanOrEqual(2)
})
