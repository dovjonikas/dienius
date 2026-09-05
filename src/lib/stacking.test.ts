import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Containment makes a stacking context, and a stacking context paints in
 * DOM order unless it says where it sits.
 *
 * `contain: layout style` went onto quick-add in v2.0 to stop typing from
 * re-laying-out the day beside it, with a note that paint containment was
 * avoided because it would clip the two panels that hang out of the box. It
 * was the right note about the wrong effect: layout containment makes a
 * stacking context too, and from that commit until v2.1 the time and
 * duration panels painted behind the first task card on every viewport -
 * one row of chips showed and the rest was under the list. jsdom cannot
 * see it, and the sweep never opens those panels. This reads the stylesheet
 * instead: every rule that contains also says its z-index, so the next
 * containment boundary cannot quietly bury what hangs out of it.
 */
// Comments go first: a comment that says "z-index" is not a declaration, and
// the one above .quick-add-block says it twice.
const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Every `selector { declarations }` pair, inside or outside an @media block. */
function blocks(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (const m of css.matchAll(re)) {
    // What precedes a rule can include the closing of the previous @media
    // block's own line; the selector is the last line of it.
    const selector = m[1].trim().split('\n').at(-1)!.trim()
    out.push({ selector, body: m[2] })
  }
  return out
}

test('every rule that contains layout or paint also places its stacking context with a z-index', () => {
  const containing = blocks().filter(b => /contain\s*:\s*[^;]*(layout|paint|strict|content)/.test(b.body))
  expect(containing.length).toBeGreaterThan(0)
  for (const block of containing) {
    expect(block.body, block.selector).toMatch(/z-index\s*:/)
  }
})

test('quick-add sits above the task list, so its panels are not painted behind the first card', () => {
  const quickAdd = blocks().find(b => b.selector === '.quick-add-block')
  expect(quickAdd).toBeTruthy()
  expect(quickAdd!.body).toMatch(/position\s*:\s*relative/)
  const z = Number(/z-index\s*:\s*(\d+)/.exec(quickAdd!.body)?.[1])
  expect(z).toBeGreaterThan(0)
})
