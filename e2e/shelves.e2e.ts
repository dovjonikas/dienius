import { expect, test } from '@playwright/test'
import { card, openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The shelves that are not the day - CONVENTIONS section 14 - and the doors
 * between them: a line typed as backlog and pulled onto the day in one
 * press, a scratch line that a leading "!" sends to the inbox instead, and
 * the #bug export landing on the clipboard as a markdown list.
 */

test.use({ timezoneId: 'Europe/Vilnius', permissions: ['clipboard-read', 'clipboard-write'] })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('a backlog item is pulled onto the day at the first slot that holds it, and leaves the backlog', async ({ page }) => {
  await page.getByRole('group', { name: 'What Enter does' }).getByRole('button', { name: 'Backlog' }).click()
  const box = page.getByPlaceholder('Something to do, just not today...')
  await box.fill('Renew the passport')
  await box.press('Enter')
  await expect(box).toHaveValue('')

  const fold = page.getByRole('button', { name: /^Backlog 1$/ })
  await fold.click()
  await page.getByRole('button', { name: 'Put "Renew the passport" on this day' }).click()

  // Deep work runs to eleven and Standup to quarter past; the first gap that
  // holds thirty minutes opens at 11:15, which is the slot quick-add's own
  // time control would have offered.
  await expect(card(page, 'Renew the passport')).toContainText('11:15')
  // The fold is gone with its last item; the capture toggle of the same name stays.
  await expect(page.getByRole('button', { name: /^Backlog \d+$/ })).toHaveCount(0)
})

test('a scratch line starting with "!" goes to the inbox, and #bug notes export as a markdown list', async ({ page }) => {
  await page.keyboard.press('s')
  const scratch = page.getByRole('dialog', { name: 'Scratch' })
  const note = scratch.getByRole('textbox', { name: 'Scratch note' })

  // The marker says where the line is going before Enter, not after.
  const toggle = scratch.getByRole('button', { name: /Make it a (note|task) instead/ })
  await expect(toggle).toHaveText('Note')
  await note.pressSequentially('!Buy stamps')
  await expect(toggle).toHaveText('Task')
  await note.press('Enter')
  await expect(scratch.getByRole('status')).toContainText('Sent to the inbox.')
  await expect(toggle).toHaveText('Note')

  await note.pressSequentially('#bug the week view loses its chip when narrowed')
  await note.press('Enter')
  await expect(scratch.getByText('1 note')).toBeVisible()

  await scratch.getByRole('button', { name: 'Export bugs' }).click()
  await expect(scratch.getByRole('status')).toContainText('Copied 1 bug as a markdown list.')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe('- 2026-09-16: the week view loses its chip when narrowed')

  await page.keyboard.press('Escape')
  await expect(scratch).toHaveCount(0)

  // The stamps line is in the inbox, without its mark, and nowhere in scratch.
  await page.getByRole('button', { name: /^Inbox 1$/ }).click()
  await expect(page.getByText('Buy stamps')).toBeVisible()
  await expect(page.getByText('!Buy stamps')).toHaveCount(0)
})
