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

  // Nothing written: one line and one button, and no field until asked.
  await expect(page.getByRole('textbox', { name: 'North' })).toHaveCount(0)
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await expect(box).toBeFocused()
  // An example of the shape, nobody's words: headings and a signature.
  await expect(box).toHaveAttribute('placeholder', /\n---\n/)
  await box.fill('First line here\nSecond line here\n\nThird line here')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

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
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await box.fill('First line here\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second\n---\na signature line')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

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

  // And on the day: the signature and the headings, never the introduction.
  // Beside the day on a desktop, where a resting pointer shows what a heading
  // holds; on the phone one folded line, a tap opening the headings and a tap
  // on one its words.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today', exact: true }).click()
  if (info.project.name === 'phone') {
    const north = page.getByRole('group', { name: 'North' })
    await north.getByRole('button', { name: 'a signature line' }).tap()
    const heading = north.getByRole('button', { name: 'FIRST HEADING' })
    await heading.tap()
    const words = north.locator('.north-section').first().locator('.north-paragraph')
    await expect(words).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(words.nth(1)).toBeVisible()
    await heading.tap()
    await expect(words.first()).toBeHidden()
  } else {
    const north = page.getByRole('region', { name: 'North' })
    await expect(north.getByText('a signature line')).toBeVisible()
    const words = north.locator('.north-section').first().locator('.north-paragraph')
    await expect(words.first()).toBeHidden()
    await north.getByRole('button', { name: 'FIRST HEADING' }).hover()
    await expect(words).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(words.nth(1)).toBeVisible()
    await page.mouse.move(700, 5)
    await expect(words.first()).toBeHidden()
  }
  await expect(page.getByText('First line here')).toHaveCount(0)
})
