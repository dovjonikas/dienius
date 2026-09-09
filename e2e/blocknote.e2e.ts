import { expect, test } from '@playwright/test'
import { card, openFreshAt, quickAdd, wednesdayAt } from './app'

/**
 * A note written into a template block, read on the day it lands.
 *
 * Walked in a browser because two of the promises cannot be seen in jsdom:
 * that reading a note happens on the day rather than by going somewhere
 * else, and that the mark is a real target at 390px.
 *
 * The owner's words were that a meal block should arrive carrying what to
 * make. Before v2.11 a template could hold only a title and a time, so text
 * typed into one reached no day at all.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

/**
 * The template rail is the wide layout's - see DayView - so the walk from a
 * template to a stamped day is a desktop one. What the phone has to answer
 * is the second test, which builds its note the way a phone would.
 */
test('a note written into a block arrives on the day, and one press reads it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the template rail is the wide layout&apos;s')
  await openFreshAt(page, wednesdayAt(10))

  await page.getByRole('button', { name: 'Templates', exact: true }).first().click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('Meals')
  await page.getByPlaceholder('09:00').fill('12:00')
  await page.getByPlaceholder('What happens').fill('Meal')
  await page.getByRole('button', { name: 'Add a block' }).click()
  await page.getByRole('button', { name: 'Add a note to Meal' }).click()
  await page.getByRole('textbox', { name: 'Note on Meal' }).fill('Rice and chicken\n  200 g rice')
  await page.getByRole('button', { name: 'Save template' }).click()

  await page.getByRole('button', { name: 'Today', exact: true }).first().click()
  // Scoped to the rail: a category called Meals ships by default, so the
  // name alone is two buttons on this screen.
  await page.locator('.template-rail').getByRole('button', { name: 'Meals' }).click()

  const meal = card(page, 'Meal')
  await expect(meal).toBeVisible()
  await expect(page.getByText('200 g rice')).toHaveCount(0)

  // One press, on the day. Not the actions menu, and not another screen.
  await meal.getByRole('button', { name: 'Read the note on Meal' }).click()
  await expect(meal.getByText('200 g rice')).toBeVisible()
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
})

test('the note mark is a real target, and opens under the card it belongs to', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, '12:00 Meal')

  await card(page, 'Meal').getByRole('button', { name: /^More actions for Meal/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel(/^Note/).fill('Rice and chicken')
  await sheet.getByRole('button', { name: 'Done' }).click()

  const meal = card(page, 'Meal')
  const mark = meal.getByRole('button', { name: 'Read the note on Meal' })
  await expect(mark).toBeVisible()

  const markBox = await mark.boundingBox()
  if (!markBox) throw new Error('the note mark is not on the screen')
  // Not 44px: it is one of the row's marks, sized like the others, on a card
  // whose own body is the large target. What it has to be is pressable at
  // all - it was a span, so the note it named could only be reached through
  // the actions menu and then Details.
  expect(markBox.height).toBeGreaterThanOrEqual(16)

  await mark.click()
  const text = meal.getByText('Rice and chicken')
  await expect(text).toBeVisible()

  // Under the card, inside it - not a layer over the day.
  const textBox = await text.boundingBox()
  const cardBox = await meal.boundingBox()
  if (!textBox || !cardBox) throw new Error('the note or its card is not on the screen')
  expect(textBox.y).toBeGreaterThan(markBox.y)
  expect(textBox.y + textBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1)
})

/**
 * The rule the editor now says out loud, walked end to end.
 *
 * `## ` has started a section since v2.13 and the card has drawn those
 * headings as choices for just as long, but nothing in the editor mentioned
 * it - so the owner used the app for a week without knowing. This walks the
 * whole promise in one go: the rule is on the screen before anything is
 * typed, the preview under the box is the card's own choices, and the card
 * it was promising really does carry them.
 */
test('the editor says what a heading does, and the card does it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the template rail is the wide layout&apos;s')
  await openFreshAt(page, wednesdayAt(10))

  await page.getByRole('button', { name: 'Templates', exact: true }).first().click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('Meals')
  await page.getByPlaceholder('09:00').fill('12:00')
  await page.getByPlaceholder('What happens').fill('Meal')
  await page.getByRole('button', { name: 'Add a block' }).click()
  await page.getByRole('button', { name: 'Add a note to Meal' }).click()

  const box = page.getByRole('textbox', { name: 'Note on Meal' })
  // Said before a key is pressed: the example in the box and the line under
  // it. Neither is behind a hover or a press.
  await expect(box).toHaveAttribute('placeholder', /## /)
  await expect(page.getByText('A line that starts with ## becomes a choice on the card.')).toBeVisible()
  // An empty note has no choices, so there is nothing to preview yet.
  await expect(page.locator('.note-editor-preview')).toHaveCount(0)

  await box.fill('Pick one.\n\n## Soup\nWhatever is in the fridge.\n\n## Eggs\nFour, and the bread.')

  const preview = page.locator('.note-editor-preview')
  await expect(preview.getByRole('button', { name: 'Soup, on Meal' })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Eggs, on Meal' })).toBeVisible()

  await page.getByRole('button', { name: 'Save template' }).click()
  await page.getByRole('button', { name: 'Today', exact: true }).first().click()
  await page.locator('.template-rail').getByRole('button', { name: 'Meals' }).click()

  // The same two, on the card, without opening anything.
  const meal = card(page, 'Meal')
  await expect(meal.getByRole('button', { name: 'Soup, on Meal' })).toBeVisible()
  await expect(meal.getByRole('button', { name: 'Eggs, on Meal' })).toBeVisible()

  await meal.getByRole('button', { name: 'Eggs, on Meal' }).click()
  await expect(page.getByRole('dialog', { name: 'Eggs, on Meal' })).toBeVisible()
  await expect(page.getByText('Four, and the bread.')).toBeVisible()
})
