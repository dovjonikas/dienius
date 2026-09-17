import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The goal's line starts where the day starts.
 *
 * It is one quiet uppercase sentence above the timeline, and at every width
 * from 1024 up it begins at the day column's left edge. From 1500 the header
 * becomes a masthead spanning the rail's column as well - so the line, a
 * full-width item inside that header, began above the mini calendar instead
 * and ran across into the timeline. The owner: "matos kad north pranesimas
 * iseina is ribu, neturetu iseit".
 *
 * Checked at three widths on either side of that breakpoint, because the bug
 * existed only above it and nothing in the repo was looking there. An
 * alignment is the sort of thing a person sees immediately and no pass here
 * measures, so it is written down as the invariant it is: the line and the
 * grid under it share a left edge.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

for (const width of [1366, 1500, 1920]) {
  test(`the goal's line and the day below it share a left edge at ${width}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the rail and the masthead are the wide layout&apos;s')
    await page.setViewportSize({ width, height: 900 })
    await openFreshAt(page, wednesdayAt(10))
    await stampWorkingDay(page)

    // A goal, because the line is only drawn when there is one. Written
    // straight into storage: what is being checked is where the line lands,
    // not the road to making one, which North's own tests walk.
    await page.evaluate(() => {
      const key = 'dienius:data'
      const d = JSON.parse(localStorage.getItem(key) ?? '{}')
      d.goals = [{ id: 'g1', title: 'A few people who know the real me', why: 'Because it is the point.', identity: 'Someone who stays.', createdAt: '2026-07-18', updatedAt: '2026-09-16T10:00:00.000Z' }]
      localStorage.setItem(key, JSON.stringify(d))
    })
    await page.reload()

    const line = page.locator('.north-line')
    await expect(line).toBeVisible()
    const lineBox = await line.boundingBox()
    const gridBox = await page.locator('.timeline-grid').first().boundingBox()
    if (!lineBox || !gridBox) throw new Error('the day did not lay out')

    expect(Math.abs(lineBox.x - gridBox.x)).toBeLessThanOrEqual(1)
    // And it stays inside the window, which is what "out of bounds" meant.
    expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(width)
  })
}

/**
 * Where North has a text, the day's top carries one line of it and the
 * signature under it, since v2.26. The line is never cut: a line longer than
 * the day's column wraps. A press opens North.
 */
test("the text's line on the day is whole however long, the signature is under it, and a press opens North", async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'measured at the wide masthead')
  await page.setViewportSize({ width: 1366, height: 900 })
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  const long = 'a line under the heading that runs on for long enough that no day column in this app could hold it on one line, however wide the window is'
  await page.evaluate(line => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.picture = { text: `An introduction line.\n\nONLY HEADING\n${line}\n---\nA signature line.`, updatedAt: '2026-09-16T08:00:00.000Z' }
    localStorage.setItem(key, JSON.stringify(d))
  }, long)
  await page.reload()

  const words = page.locator('.north-line-words')
  await expect(words).toHaveText(long)
  await expect(page.locator('.north-line-signature')).toHaveText('A signature line.')
  await expect(page.getByText('An introduction line.')).toHaveCount(0)
  // Whole: nothing clipped sideways, and more than one line tall.
  const size = await words.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
  expect(size.height).toBeGreaterThan(size.line * 1.5)
  // Inside the day's column.
  const lineBox = await words.boundingBox()
  const grid = await page.locator('.timeline-grid').first().boundingBox()
  expect(lineBox!.x + lineBox!.width).toBeLessThanOrEqual(grid!.x + grid!.width + 1)

  await page.locator('.north-line-text').click()
  await expect(page.getByRole('heading', { name: 'North' })).toBeVisible()
})
