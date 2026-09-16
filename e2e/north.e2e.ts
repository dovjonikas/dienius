import { expect, test } from '@playwright/test'
import { openFreshAt, reopenAt, wednesdayAt } from './app'

/**
 * North as a text: written on the page, read as blocks, and the first thing
 * the app opens on in the morning.
 *
 * The jsdom tests hold each piece; what they cannot see is the whole walk
 * on a real screen, and on the phone's screen in particular, since a text
 * read every morning is read on whichever device is in hand. Every line
 * typed here is a generic one: the app carries nobody's text and neither
 * does this test.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('the text is written on the page, reads back as blocks, and opens the next morning', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // A fresh app opens on the day: there is no text to read yet.
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()

  // Nothing written: the page is the editor, and it says only where to write.
  const box = page.getByRole('textbox', { name: 'North' })
  await expect(box).toBeFocused()
  await expect(box).toHaveAttribute('placeholder', 'Write here.')
  await box.fill('First line here\nSecond line here\n\nThird line here')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Read: no heading, so the whole text, the blank line kept as a paragraph break.
  const blocks = page.locator('.north-intro .north-paragraph')
  await expect(blocks).toHaveCount(2)
  await expect(blocks.nth(0)).toHaveText('First line here\nSecond line here')
  await expect(blocks.nth(1)).toHaveText('Third line here')
  await expect(page.getByRole('button', { name: 'Start the day' })).toHaveCount(0)

  // The next morning the app opens on it, and Start the day is the way on.
  await reopenAt(page, wednesdayAt(7 + 24))
  await expect(page.getByRole('region', { name: 'North' })).toBeVisible()
  await expect(blocks.nth(0)).toHaveText('First line here\nSecond line here')
  await page.getByRole('button', { name: 'Start the day' }).click()
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()

  // Opened again the same day, it is the day.
  await reopenAt(page, wednesdayAt(9 + 24))
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await expect(page.getByRole('region', { name: 'North' })).toHaveCount(0)
})

/**
 * A line in capitals is a heading and owns everything to the next one, and
 * what it holds comes when asked: on a hover where there is a pointer, over
 * the page and moving nothing, and on a tap where there is not. The jsdom
 * tests hold the state; this is the one place the two ways of asking are
 * walked on the screens that have them.
 */
test('a heading opens on a hover without moving the page, or on a tap where there is no pointer, and closes again', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await box.fill('First line here\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // At rest: the introduction, the two headings, and nothing under them.
  await expect(page.locator('.north-intro .north-paragraph')).toHaveText('First line here')
  const first = page.getByRole('button', { name: 'FIRST HEADING' })
  const second = page.getByRole('button', { name: 'SECOND HEADING' })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  const lines = page.locator('.north-section').first().locator('.north-paragraph')
  await expect(lines.first()).toBeHidden()

  if (info.project.name === 'phone') {
    await first.tap()
    await expect(lines).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(lines.nth(1)).toBeVisible()
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await first.tap()
    await expect(lines.first()).toBeHidden()
  } else {
    const edit = page.getByRole('button', { name: 'Edit', exact: true })
    const editAtRest = await edit.boundingBox()
    await first.hover()
    await expect(lines.nth(1)).toBeVisible()
    await expect(lines).toHaveText(['a line under it', 'a second paragraph under it'])
    // Nothing on the page moved to make the room (CONVENTIONS 24).
    expect(await edit.boundingBox()).toEqual(editAtRest)
    // Down to where the second heading is drawn, and its words take over.
    const at = await second.boundingBox()
    await page.mouse.move((at?.x ?? 0) + 20, (at?.y ?? 0) + (at?.height ?? 0) / 2, { steps: 5 })
    await expect(lines.first()).toBeHidden()
    await expect(page.locator('.north-section').nth(1).locator('.north-paragraph')).toBeVisible()
    // Away, and it is gone: a hover pins nothing.
    await page.mouse.move(5, 5)
    await expect(page.locator('.north-section').nth(1).locator('.north-paragraph')).toBeHidden()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
  }

  // And on the day: the headings in a row under the title, a press opens
  // every paragraph a heading holds, and a second press closes it.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today', exact: true }).click()
  const strip = page.getByRole('group', { name: 'North' })
  const heading = strip.getByRole('button', { name: 'FIRST HEADING' })
  await expect(heading).toBeVisible()
  await heading.click()
  await expect(page.locator('.north-strip-lines')).toHaveText(['a line under it', 'a second paragraph under it'])
  await heading.click()
  await expect(page.locator('.north-strip-lines')).toHaveCount(0)
})
