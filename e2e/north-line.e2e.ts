import { expect, test, type Page } from '@playwright/test'
import { leaveAndReturnAt, openFreshAt, reopenAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * North's line starts where the day starts.
 *
 * It is one sentence above the timeline, and at every width from 1024
 * up it begins at the day column's left edge. From 1500 the header became a
 * masthead spanning the rail's column as well - so the line, a full-width
 * item inside that header, began above the mini calendar instead and ran
 * across into the timeline, out of the day's bounds, which is how it was
 * reported.
 *
 * Checked at three widths on either side of that breakpoint, because the bug
 * existed only above it and nothing in the repo was looking there. An
 * alignment is the sort of thing a person sees immediately and no pass here
 * measures, so it is written down as the invariant it is: the line and the
 * grid under it share a left edge.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

for (const width of [1366, 1500, 1920]) {
  test(`North's line and the day below it share a left edge at ${width}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the rail and the masthead are the wide layout&apos;s')
    await page.setViewportSize({ width, height: 900 })
    await openFreshAt(page, wednesdayAt(10))
    await stampWorkingDay(page)

    // A text with a line under a heading, because the line is only drawn
    // when there is one. Written straight into storage: what is being checked
    // is where the line lands, not the road to writing it, which North's own
    // tests walk. It was a goal until goals were retired in v2.28.
    await page.evaluate(() => {
      const key = 'dienius:data'
      const d = JSON.parse(localStorage.getItem(key) ?? '{}')
      d.picture = { text: 'FIRST HEADING\na line under it\n---\nA signature line.', updatedAt: '2026-09-16T10:00:00.000Z' }
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
 * Where North has a text, the day's top carries one line of it, since v2.26,
 * and from 21:00 the signature under it, since v2.28. The line is never cut:
 * a line longer than the day's column wraps. A press opens North.
 */
test("the text's line on the day is whole however long, the signature comes under it in the evening, and a press opens North", async ({ page }, info) => {
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
  // Ten in the morning: the line alone.
  await expect(page.locator('.north-line-signature')).toHaveCount(0)
  await expect(page.getByText('An introduction line.')).toHaveCount(0)
  // Whole: nothing clipped sideways, and more than one line tall.
  const size = await words.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height, line: parseFloat(getComputedStyle(el).lineHeight) }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
  expect(size.height).toBeGreaterThan(size.line * 1.5)
  // Inside the day's column.
  const lineBox = await words.boundingBox()
  const grid = await page.locator('.timeline-grid').first().boundingBox()
  expect(lineBox!.x + lineBox!.width).toBeLessThanOrEqual(grid!.x + grid!.width + 1)

  // After nine, the signature under the same line, in the same press.
  await reopenAt(page, wednesdayAt(21, 30))
  await expect(words).toHaveText(long)
  const signature = page.locator('.north-line-text .north-line-signature')
  await expect(signature).toHaveText('A signature line.')
  const [wordsBox, signatureBox] = [await words.boundingBox(), await signature.boundingBox()]
  expect(signatureBox!.y).toBeGreaterThanOrEqual(wordsBox!.y + wordsBox!.height - 1)

  await page.locator('.north-line-text').click()
  await expect(page.getByRole('heading', { name: 'North' })).toBeVisible()
})

/** North's text, written straight into storage, and the page reloaded on it. */
async function writeNorth(page: Page, text: string): Promise<void> {
  await page.evaluate(value => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.picture = { text: value, updatedAt: '2026-09-16T08:00:00.000Z' }
    localStorage.setItem(key, JSON.stringify(d))
  }, text)
  await page.reload()
  await page.getByRole('navigation').first().waitFor()
}

/**
 * The day's line on a real clock, the whole way round, on both screens: the
 * same line all day, another the next day, the morning heading's line in
 * the hours after waking - a night away, not a reload - the evening
 * heading's after nine, and the untagged headings' between. Two lines for
 * the day, so the next day can be seen to take the other. The tags are read
 * and never shown, on the day or in the window after sleep. The unit tests
 * hold each rule; this is the one place they run on a clock that moves and a
 * page that is left and opened again.
 */
test("the day's line keeps to the day and its hours, and no tag is ever shown", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
  await writeNorth(
    page,
    'An introduction line.\n\nWAKING [morning]\na line for the morning\nTHE DAY\na first line for the day\na second line for the day\nWINDING DOWN [Evening]\na line for the evening\n---\nA signature line.',
  )
  const words = page.locator('.north-line-words')
  const tags = /\[(morning|evening)\]/i

  // Wednesday, ten in the morning and nobody just woken: a line for the day,
  // and no signature before the evening.
  await expect(words).toHaveText(/^a (first|second) line for the day$/)
  const wednesday = await words.textContent()
  await expect(page.locator('.north-line-signature')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(tags)
  await expect(page.getByText('An introduction line.')).toHaveCount(0)

  // Later the same day, the same line.
  await reopenAt(page, wednesdayAt(16))
  await expect(words).toHaveText(wednesday!)

  // After nine, the evening's, and the signature under it.
  await reopenAt(page, wednesdayAt(21, 30))
  await expect(words).toHaveText('a line for the evening')
  await expect(page.locator('.north-line-signature')).toHaveText('A signature line.')
  await expect(page.locator('body')).not.toContainText(tags)

  // Thursday, after a night away: the window after sleep, and under it the
  // morning's line.
  await leaveAndReturnAt(page, wednesdayAt(7 + 24))
  const window = page.getByRole('dialog', { name: 'North' })
  await expect(window).toBeVisible()
  await expect(window).not.toContainText(tags)
  await window.getByRole('button', { name: 'Close' }).click()
  await expect(words).toHaveText('a line for the morning')
  await expect(page.locator('.north-line-signature')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(tags)

  // Three hours on, the morning is over: Thursday's line for the day, the
  // other one.
  await reopenAt(page, wednesdayAt(10, 30 + 24 * 60))
  await expect(words).toHaveText(/^a (first|second) line for the day$/)
  expect(await words.textContent()).not.toBe(wednesday)
})

/**
 * On the phone the day's North is one group under the progress: its line -
 * with the signature under it in the evening - and the word North with the
 * caret every fold carries, opening the headings. The group ends with more
 * air under it than there is inside it, so what follows reads as the next
 * thing on the day and not as something the word North labels.
 */
test('on the phone the line and the fold stand together, with more air under them than inside', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the fold is the phone layout&apos;s')
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
  await writeNorth(page, 'FIRST HEADING\na line under it\n---\nA signature line.')

  const fold = page.getByRole('group', { name: 'North' }).getByRole('button', { name: 'North', exact: true })
  await expect(fold).toBeVisible()
  await expect(fold.locator('.north-day-caret')).toBeVisible()
  const air = await page.evaluate(() => {
    const line = document.querySelector('.north-line')!.getBoundingClientRect()
    const group = document.querySelector('.north-day.is-folded')!
    const fold = group.getBoundingClientRect()
    // The next thing drawn on the day after the group, whatever it is.
    const after = [...document.querySelectorAll('.day-view *')]
      .map(el => el.getBoundingClientRect())
      .filter(box => box.height > 0 && box.top >= fold.bottom)
      .reduce((top, box) => Math.min(top, box.top), Infinity)
    return { inside: fold.top - line.bottom, under: after - fold.bottom }
  })
  expect(air.under).toBeGreaterThan(air.inside)

  await fold.tap()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('group', { name: 'North' }).getByRole('button', { name: 'FIRST HEADING' })).toBeVisible()
})

/**
 * The end of the day, v2.28, on both screens: from 21:00 the signature
 * stands under the day's line, and the card that closes the day ends on it
 * too. Before 21:00 neither shows it. The picture is never on the day.
 */
test("the day ends on North's signature: under the day's line after nine, and at the end of the card that closes it", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(20, 30))
  await stampWorkingDay(page)
  await writeNorth(page, 'A picture line.\n\nTHE DAY\na line for the day\n---\nA signature line.')

  // Half past eight: the day's line alone, and no card yet.
  await expect(page.locator('.north-line-words')).toHaveText('a line for the day')
  await expect(page.locator('.north-line-signature')).toHaveCount(0)

  // Twenty to ten: the evening close is out, and the signature is in both places.
  await reopenAt(page, wednesdayAt(21, 40))
  await expect(page.locator('.north-line-text .north-line-signature')).toHaveText('A signature line.')
  const card = page.getByLabel('Closing the day')
  await expect(card).toBeVisible()
  await expect(card.locator('.evening-close-north')).toHaveText('A signature line.')
  await expect(page.getByText('A picture line.')).toHaveCount(0)
})
