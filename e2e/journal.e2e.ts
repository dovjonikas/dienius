import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The journal: a line in the morning, two questions at the close, and the
 * week copied as markdown. On a phone the promise is that the evening card
 * asks its questions where a thumb can answer them without scrolling, so
 * that is measured at 390x844 with the clock pinned past the closing time;
 * on a desktop the copy is read back off the real clipboard.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('phone: at the close the two questions and the button fit without a scroll, and what is written is kept', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone walk')
  // Ten o'clock at night: past the closing time on a day that is not done.
  await openFreshAt(page, wednesdayAt(22))
  await stampWorkingDay(page)

  const card = page.getByLabel('Closing the day')
  await expect(card).toBeVisible()
  const real = card.getByRole('textbox', { name: 'What was real today?' })
  const tomorrow = card.getByRole('textbox', { name: 'What do I want to tell myself tomorrow?' })
  const close = card.getByRole('button', { name: 'Close the day' })

  // Stamping the starter scrolled the page to its button, as a tap on it
  // does; the walk starts from the top, where a person opening the app is,
  // and nothing below has to move for the questions to be answered.
  await page.evaluate(() => window.scrollTo(0, 0))
  const viewport = page.viewportSize()!
  for (const control of [real, tomorrow, close]) {
    const box = await control.boundingBox()
    expect(box, 'the control is laid out').toBeTruthy()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await real.fill('Dad called')
  await tomorrow.fill('Start with the walk')
  await close.click()
  await expect(card).toHaveCount(0)

  const line = page.getByRole('textbox', { name: 'Today, in one line' })
  await line.fill('Ship the pricing page')
  await line.press('Enter')

  // The week's reading carries all three, under the day.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('group', { name: 'Calendar view' }).getByRole('button', { name: 'Week' }).click()
  await page.getByRole('group', { name: 'How to read the week' }).getByRole('button', { name: 'Agenda' }).click()
  await expect(page.getByText('Ship the pricing page')).toBeVisible()
  await expect(page.getByText('Dad called')).toBeVisible()
  await expect(page.getByText('Start with the walk')).toBeVisible()
})

test('desktop: the week copies as markdown, read back off the clipboard', async ({ page, isMobile, context }) => {
  test.skip(isMobile, 'the desktop walk')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)

  const line = page.getByRole('textbox', { name: 'Today, in one line' })
  await line.fill('Ship the pricing page')
  await line.press('Enter')

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('group', { name: 'Calendar view' }).getByRole('button', { name: 'Week' }).click()
  await page.getByRole('button', { name: 'Copy week journal' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()

  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('# Journal, 14 - 20 September 2026')
  expect(text).toContain('## Wednesday, September 16')
  expect(text).toContain('- **Today:** Ship the pricing page')
  expect(text).not.toContain('Monday')
})
