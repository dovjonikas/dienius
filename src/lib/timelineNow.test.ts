import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The current-time line runs behind the blocks, not over them.
 *
 * A stylesheet test because this is a stylesheet fact, and because it came
 * back once: the line was painted after the anchors so it would read as one
 * continuous mark across the day, which is right for a tall block - the
 * anchor pins its text to the top so the line crosses empty space. A short
 * block has no empty space. Its title and its time are the top line, and the
 * line went straight through both - on the one block that is happening now,
 * whose time is the one time on the day worth reading.
 */
const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')

/** The value of one property inside the first rule matching a selector. */
function declaration(selector: string, property: string): string | undefined {
  const at = css.indexOf(`${selector} {`)
  if (at < 0) return undefined
  const end = css.indexOf('}', at)
  const found = css.slice(at, end).match(new RegExp(`${property}\s*:\s*([^;]+);`))
  return found?.[1].trim()
}

test('the now line sits under the blocks it crosses', () => {
  const line = Number(declaration('.timeline-now-line', 'z-index'))
  const anchor = Number(declaration('.timeline-anchor', 'z-index'))
  expect(Number.isNaN(line), 'the now line has no z-index of its own').toBe(false)
  expect(Number.isNaN(anchor), 'the anchor has no z-index of its own').toBe(false)
  expect(line).toBeLessThan(anchor)
})

test('the dot in the gutter still sits above everything', () => {
  // It marks the hour on the axis, where no block reaches, so it keeps the
  // layer it always had.
  const dot = Number(declaration('.timeline-now-dot', 'z-index'))
  const anchor = Number(declaration('.timeline-anchor', 'z-index'))
  expect(dot).toBeGreaterThan(anchor)
})
