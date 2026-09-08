import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * The focus screen is centred on the window, and the stylesheet is where
 * that can be checked.
 *
 * jsdom has no layout, so a rendered test cannot measure a centre; the
 * geometry was measured in a real browser at 1920, 1600 and 1366, where the
 * ring's centre and the window's centre are the same pixel. What this test
 * holds is the one declaration that makes it true, so it cannot be tidied
 * away by somebody who reads it as a stray calc.
 *
 * Why it is needed: `html` carries `scrollbar-gutter: stable`, which
 * reserves the classic scrollbar's width whether or not the page scrolls, so
 * an element in the initial containing block - anything `position: fixed` -
 * is ten pixels narrower than the window on a desktop. A screen that centres
 * one big ring inside that box sits five pixels left of where the eye
 * measures from, and the ten pixels it stops short of are painted in the
 * same background colour, so nothing shows there but the offset. Adding
 * `100vw - 100%` to the left padding gives them back: the gutter's width
 * where there is a gutter, and zero where the scrollbar floats over the
 * page, as it does on a phone.
 */
const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8').replace(/\r\n/g, '\n')

function ruleBody(selector: string): string {
  const at = css.indexOf(`\n${selector} {`)
  expect(at, `${selector} is not in the stylesheet`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('}', at))
}

test('the focus screen adds the scrollbar gutter back, so it centres on the window and not on the box left over', () => {
  const body = ruleBody('.focus-view')
  expect(body).toMatch(/position:\s*fixed/)
  expect(body.replace(/\s+/g, ' ')).toContain('calc(var(--s6) + (100vw - 100%))')
})
