import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * A journal, not a form.
 *
 * v2.3 asked three questions on a schedule - a line in the morning and two
 * on the evening close card - and the owner's verdict was that it was too
 * much. What is left is a day and whatever anybody wanted to say on it,
 * written from the clock at any moment, with no questions on it at all. See
 * DECISIONS "A journal, not a form".
 *
 * The phone walk is the one that matters: open it, write, close it, and the
 * whole thing has to fit 390x844 without a scroll, because writing a
 * sentence should not begin with scrolling.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('phone: the journal opens, takes a sentence and closes, with nothing scrolled', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone walk')
  await openFreshAt(page, wednesdayAt(22))
  await stampWorkingDay(page)
  await page.evaluate(() => window.scrollTo(0, 0))

  // Its own button in the header now, next to Notes. It was the clock
  // panel's fourth tab, and this walk opened the clock first - which now
  // puts a scrim over the very button it is reaching for.
  await page.getByRole('button', { name: 'Journal' }).click()

  const box = page.getByRole('textbox', { name: /^Journal for / })
  await expect(box).toBeVisible()
  // The box and both arrows are on screen at once: writing a sentence must
  // not begin with hunting for the box. The browser's own focus scroll is
  // allowed - that is it bringing the box to the person, which is the
  // opposite of the failure this guards.
  const viewport = page.viewportSize()!
  for (const control of [box, page.getByRole('button', { name: 'The day before' }), page.getByRole('button', { name: 'Open full' })]) {
    const laid = await control.boundingBox()
    expect(laid, 'the control is laid out').toBeTruthy()
    expect(laid!.y).toBeGreaterThanOrEqual(0)
    expect(laid!.y + laid!.height).toBeLessThanOrEqual(viewport.height)
  }

  await box.fill('Rained all afternoon. Walked anyway.')
  // It saves itself; there is no button to press and never was.
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const written = await page.evaluate(() => {
    const days = JSON.parse(localStorage.getItem('dienius:data')!).days as Record<string, { journal?: string }>
    return Object.values(days).map(d => d.journal).filter(Boolean)
  })
  expect(written).toEqual(['Rained all afternoon. Walked anyway.'])
})

test('the evening card asks nothing, and offers only the way out of the day', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone walk')
  await openFreshAt(page, wednesdayAt(22))
  await stampWorkingDay(page)

  const card = page.getByLabel('Closing the day')
  await expect(card).toBeVisible()
  await expect(card.getByRole('textbox')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Close the day' })).toBeVisible()
  await expect(card.getByRole('button', { name: /unfinished - push to tomorrow/ })).toBeVisible()
})

test('desktop: a month copies as markdown, read back off the clipboard', async ({ page, isMobile, context }) => {
  test.skip(isMobile, 'the desktop walk')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  await page.keyboard.press('j')
  const box = page.getByRole('textbox', { name: /^Journal for / })
  await box.fill('Ship the pricing page')
  await page.getByRole('button', { name: 'Open full' }).click()

  const journal = page.getByRole('dialog', { name: 'Journal' })
  await expect(journal).toBeVisible()
  await journal.getByRole('button', { name: 'Copy this month' }).click()
  await expect(journal.getByRole('button', { name: 'Copied' })).toBeVisible()

  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('# Journal, September 2026')
  expect(text).toContain('## Wednesday, September 16')
  expect(text).toContain('Ship the pricing page')
  // Days with nothing written are not listed, ever.
  expect(text).not.toContain('Tuesday, September 15')
})
