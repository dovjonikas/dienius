import { expect, test } from '@playwright/test'
import { card, openFreshAt, quickAdd, reopenAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The three doors of a day that broke - CONVENTIONS section 12 - walked in
 * a real browser against the starter Working day, with the clock pinned to
 * ten on a Wednesday so the same blocks are ahead of now on every run. Each
 * door is one question, shows its answer before Accept, and applies in one
 * commit; what is checked here is the answer and what the day looks like
 * after the press, never the arithmetic - replan.test.ts owns that.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('something came up at a time: the block lands, the routine it hits is left alone, and a one-off waits', async ({ page }) => {
  await page.getByRole('button', { name: 'Replan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await sheet.getByRole('button', { name: 'Something came up' }).click()

  // The v2 sheet: a name in the words, a time behind "A time", a length.
  await sheet.getByRole('textbox', { name: 'What came up' }).fill('Dentist')
  await sheet.getByRole('button', { name: 'A time' }).click()
  await sheet.getByLabel('Start time').fill('13:30')
  await sheet.getByRole('group', { name: 'How long' }).getByRole('button', { name: '1h', exact: true }).click()

  // Meetings runs 13:30 to 15:00 on the starter day and comes from its
  // template, so since v2.5 it is not in the way at all: the routine stays
  // where it is and the dentist goes over it. CONVENTIONS section 12,
  // rule 1.
  const summary = sheet.getByRole('status')
  await expect(summary).toContainText('The routine stays: Meetings.')
  await expect(summary).toContainText('Free today:')
  await expect(summary).not.toContainText(/missed|failed|behind|only|should/i)
  await expect(summary).not.toContainText('Skipped')

  await sheet.getByRole('button', { name: 'Accept' }).click()
  await expect(sheet).toHaveCount(0)

  await expect(card(page, 'Dentist')).toContainText('13:30')
  await expect(page.getByRole('checkbox', { name: 'Meetings' })).toBeAttached()
})

/**
 * And the other half of the same rule: a one-off in the way is set aside
 * rather than dropped, waits on the shelf under the day, and one press
 * brings it back. The owner's scenario end to end - see DECISIONS "Set
 * aside, not deleted".
 */
test('a one-off in the way waits on the shelf, and one press brings it back', async ({ page }) => {
  await quickAdd(page, '13:45 Post the parcel 20 min')

  await page.getByRole('button', { name: 'Replan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await sheet.getByRole('button', { name: 'Something came up' }).click()
  await sheet.getByRole('textbox', { name: 'What came up' }).fill('Dentist')
  await sheet.getByRole('button', { name: 'A time' }).click()
  await sheet.getByLabel('Start time').fill('13:30')
  await sheet.getByRole('group', { name: 'How long' }).getByRole('button', { name: '1h', exact: true }).click()

  await sheet.getByRole('group', { name: 'For all of them' }).getByRole('button', { name: 'Skip' }).click()
  await expect(sheet.getByRole('status')).toContainText('Set aside, waiting: Post the parcel.')
  await sheet.getByRole('button', { name: 'Accept' }).click()

  // Off the list, on the shelf, still on the day.
  await expect(page.getByRole('checkbox', { name: 'Post the parcel' })).toHaveCount(0)
  const shelf = page.getByRole('button', { name: /^Post the parcel/ })
  await expect(shelf).toBeVisible()

  await shelf.click()
  await expect(page.getByRole('button', { name: 'Bring it back' })).toBeVisible()
  await page.getByRole('button', { name: 'Bring it back' }).click()
  await expect(page.getByRole('checkbox', { name: 'Post the parcel' })).toBeAttached()
})

test('shift the rest: everything from now moves later by the same amount, and the running block stays', async ({ page }) => {
  await page.getByRole('button', { name: 'Replan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await sheet.getByRole('button', { name: 'Shift the rest' }).click()
  await sheet.getByRole('group', { name: 'How much later' }).getByRole('button', { name: '+1h' }).click()

  await expect(sheet.getByRole('status')).toContainText('Everything from 10:00 moves 1h later.')
  await sheet.getByRole('button', { name: 'Accept' }).click()
  await expect(sheet).toHaveCount(0)

  await expect(card(page, 'Standup')).toContainText('12:00')
  await expect(card(page, 'Dinner')).toContainText('20:00')
  // Deep work started at nine and is under way; moving its start into the
  // future would be a lie about the present.
  await expect(card(page, 'Deep work block')).toContainText('09:00')
})

test('away and back: the day pauses, and one press fits what still fits into the time left', async ({ page }) => {
  // One task of the person's own, at the first slot that holds it (11:15),
  // so there is something the rescue can genuinely move. Every block the
  // template put there is routine and stays where it was.
  await quickAdd(page, 'Call the bank')
  await expect(card(page, 'Call the bank')).toContainText('11:15')

  await page.getByRole('button', { name: 'Replan' }).click()
  const sheet = page.getByRole('dialog', { name: 'Replan' })
  // The menu choice carries its own explanation in its name; the primary
  // button on the next screen is the bare word.
  await sheet.getByRole('button', { name: /^Away/ }).click()
  await expect(sheet).toContainText('The day pauses at 10:00.')
  await sheet.getByRole('button', { name: 'Away', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByText('Away since 10:00')).toBeVisible()

  // Back at half past three, which is what opening the app again is.
  await reopenAt(page, wednesdayAt(15, 30))
  await expect(page.getByText('Away since 10:00')).toBeVisible()
  await page.getByRole('button', { name: "I'm back" }).click()
  await expect(sheet).toContainText('Away since 10:00. Here is the rest of the day, from 15:30.')

  const summary = sheet.getByRole('status')
  await expect(summary).toContainText('on today')
  await expect(summary).toContainText('Routine blocks left where they are.')
  await expect(summary).not.toContainText(/missed|failed|behind|only|should/i)
  await sheet.getByRole('button', { name: 'Accept' }).click()
  await expect(sheet).toHaveCount(0)

  // The pause is over: the header offers Replan again, not the way back.
  await expect(page.getByText('Away since')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Replan' })).toBeVisible()
  // The call is in the first gap after now; the missed Standup was left alone.
  await expect(card(page, 'Call the bank')).toContainText('16:15')
  await expect(card(page, 'Standup')).toContainText('11:00')
})

