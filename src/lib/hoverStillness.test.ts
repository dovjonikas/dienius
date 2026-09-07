import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Nothing moves on hover - CONVENTIONS section 24.
 *
 * A pointer resting on a control may change its colour, its edge, its ink or
 * its shadow, and may show a bubble positioned over the page. It may not
 * change the control's size or position, and it may not change the flow
 * around it. Seven rules in the stylesheet lifted or grew a control under
 * the pointer until v2.6 - a pixel or two, a twelve percent scale - and each
 * had survived the older rule about hover and *layout* because none of them
 * moved anything else. The owner's rule is stricter and this reads the
 * stylesheet to hold it: no `:hover` rule may set any of the properties
 * below.
 *
 * Read as text, the way scale.test.ts and gridAreas.test.ts read it, because
 * jsdom has no layout and a hover state cannot be measured in it.
 */

const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

/** What a hover may not touch: anything that sizes, places or lays out. */
const MOVES = /^(transform|translate|scale|rotate|width|height|min-width|min-height|max-width|max-height|padding(-[a-z]+)?|margin(-[a-z]+)?|border|border-width|border-(top|right|bottom|left)(-width)?|font-size|font-weight|letter-spacing|line-height|display|position|top|right|bottom|left|inset|gap|flex|flex-[a-z]+|grid[a-z-]*|order|float|white-space|overflow)$/

test('no hover rule changes the size, the position or the flow of anything', () => {
  const offenders: string[] = []
  const rule = /([^{}]+?)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = rule.exec(css))) {
    const selector = m[1].trim()
    if (!selector.includes(':hover')) continue
    const line = css.slice(0, m.index).split('\n').length
    for (const declaration of m[2].split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const prop = declaration.slice(0, colon).trim()
      if (MOVES.test(prop)) offenders.push(`${selector.replace(/\s+/g, ' ')} sets ${prop} (styles.css:${line})`)
    }
  }
  expect(offenders).toEqual([])
})
