import { expect, test } from '@playwright/test'
import { card, openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The shelves that are not the day - CONVENTIONS section 14 - and the doors
 * between them: a line typed into Later and pulled onto the day in one
 * press, and a scratch line that a leading "!" sends to Later instead of
 * into the stream.
 */

test.use({ timezoneId: 'Europe/Vilnius', permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('a Later item is pulled onto the day at the first slot that holds it, and leaves Later', async ({ page }) => {
  await page.getByRole('group', { name: 'What Enter does' }).getByRole('button', { name: 'Later' }).click()
  const box = page.getByPlaceholder('Something to do, just not today')
  await box.fill('Renew the passport')
  await box.press('Enter')
  await expect(box).toHaveValue('')

  const fold = page.getByRole('button', { name: /^Later 1$/ })
  await fold.click()
  await page.getByRole('button', { name: 'Put "Renew the passport" on this day' }).click()

  // Deep work runs to eleven and Standup to quarter past; the first gap that
  // holds thirty minutes opens at 11:15, which is the slot quick-add's own
  // time control would have offered.
  await expect(card(page, 'Renew the passport')).toContainText('11:15')
  // The fold is gone with its last item; the capture toggle of the same name stays.
  await expect(page.getByRole('button', { name: /^Later \d+$/ })).toHaveCount(0)
})

test('a scratch line starting with "!" goes to Later, and the rest is kept exactly as typed', async ({ page }) => {
  await page.keyboard.press('s')
  const scratch = page.getByRole('dialog', { name: 'Notes' })
  const note = scratch.getByRole('textbox', { name: 'Note' })

  // The marker says where the line is going before Enter, not after.
  const toggle = scratch.getByRole('button', { name: /Make it a (note|task) instead/ })
  await expect(toggle).toHaveText('Note')
  await note.pressSequentially('!Buy stamps')
  await expect(toggle).toHaveText('Task')
  await note.press('Enter')
  await expect(scratch.getByRole('status')).toContainText('Sent to Later.')
  await expect(toggle).toHaveText('Note')

  // A # is a character now, not a filter: the note reads back as written and
  // there is no chip over the stream to explain. DECISIONS "Notes are notes".
  await note.pressSequentially('#bug the week view loses its chip when narrowed')
  await note.press('Enter')
  await expect(scratch.getByText('1 note')).toBeVisible()
  await expect(scratch.getByRole('listitem')).toContainText('#bug the week view loses its chip when narrowed')
  await expect(scratch.getByRole('button', { name: '#bug' })).toHaveCount(0)
  await expect(scratch.getByRole('button', { name: 'Export bugs' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(scratch).toHaveCount(0)

  // The stamps line is in Later, without its mark, and nowhere in scratch.
  await page.getByRole('button', { name: /^Later \d+$/ }).click()
  await expect(page.getByText('Buy stamps')).toBeVisible()
  await expect(page.getByText('!Buy stamps')).toHaveCount(0)
})
