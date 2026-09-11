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
