import { expect, test, type Page } from '@playwright/test'
import { openFresh, tick } from './app'

/**
 * The naive walk: nine steps, doing only and exactly what each card says,
 * finding every control by the words the card uses for it. Nothing here
 * reaches for the engine's own markup - a test that clicked whatever the
 * spotlight marked would pass with a card that said nothing useful.
 *
 * Runs on the desktop and on a phone, because the two are taught in
 * different words through different sheets, and the spotlight's first
 * failure was inside a bottom sheet.
 */
test('the tour can be walked doing only what each card says', async ({ page, isMobile }) => {
  const card = page.getByRole('dialog', { name: 'Tour' })
  const verb = isMobile ? 'Tap' : 'Click'

  await openFresh(page)
  await page.getByRole('button', { name: 'Show me around' }).click()
  await expect(card).toContainText('Two minutes, one real day')
  await card.getByRole('button', { name: 'Start' }).click()

  // Stamp a day
  await expect(card).toContainText(`${verb} Use this template under Working day`)
  await page.getByRole('button', { name: 'Use the Working day template' }).click()
  await expect(card).toContainText('Your whole day')
  await card.getByRole('button', { name: 'Next' }).click()

  // Add your own - the line changes as soon as something is typed
  await expect(card).toContainText('Type Walk in the box')
  const box = page.getByPlaceholder('Add a task')
  await box.pressSequentially('Walk')
  await expect(card).toContainText('Now press Enter.')
  await box.press('Enter')
  await expect(card).toContainText('Walk is on the day')

  // Make it key - three controls, each named as it appears
  await expect(card).toContainText(`${verb} the dots on the Walk card`)
  await page.getByRole('button', { name: 'More actions for Walk' }).click()
  await expect(card).toContainText(`${verb} Details.`)
  await page.getByRole('button', { name: 'Details' }).click()
  await expect(card).toContainText(`${verb} Mark as key.`)
  await page.getByRole('button', { name: 'Mark as key' }).click()
  await expect(card).toContainText('Walk is key now')

  // Focus - the panel the last step opened is in the way, and the card says so
  await expect(card).toContainText('Close this panel first.')
  await page.getByRole('button', { name: 'Close details' }).click()
  // Between two blocks there is no running card, and the card says so instead.
  await expect(card).toContainText(/Focus on the card running now|Nothing is running this minute/)
  await focusOrLetTheTour(page)
  await expect(card).toContainText('That bar along the bottom is Focus')
  await card.getByRole('button', { name: 'Next' }).click()

  // Tick it off
  await expect(card).toContainText(`${verb} the checkbox on Walk.`)
  await tick(page, 'Walk')
  await expect(card).toContainText('Walk moved into Done')

  // Books and series - the step ends on a book, not on a list
  await expect(card).toContainText(`${verb} Start a Books list`)
  await page.getByRole('button', { name: 'Start a Books list' }).click()
  await expect(card).toContainText('Type: Dune, 20 chapters')
  const add = page.getByLabel('Add to Books')
  await add.pressSequentially('Dune, 20 chapters')
  await expect(card).toContainText('Now press Enter.')
  await add.press('Enter')
  await expect(card).toContainText('A session can now land on any day')

  // One direction - written in Settings, shown under the day
  await expect(card).toContainText(`${verb} Write one down`)
  await page.getByRole('button', { name: 'Write one down' }).click()
  await expect(card).toContainText(`Name it, then ${verb.toLowerCase()} Write it down.`)
  await page.getByPlaceholder('Become the dad worth looking up to').fill('Finish things')
  await page.getByRole('button', { name: 'Write it down' }).click()
  await expect(card).toContainText('It lives under the day now')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Finish things')).toBeVisible()
  await card.getByRole('button', { name: 'Next' }).click()

  // The end
  await expect(card).toContainText("That's the app")
  await card.getByRole('button', { name: 'Keep what I built' }).click()
  await expect(card).toHaveCount(0)
  // Walk stayed ticked, folded into Done with the rest of what the tour made.
  await expect(page.getByRole('button', { name: /^Done \d+$/ })).toContainText('1')
})

/**
 * Focus only exists on the card running this minute, and the test runs at
 * whatever minute CI happens to reach it. When there is a running card the
 * button is pressed like anything else; when there is none the card admits
 * it and offers to start Focus itself, which is the path a person takes at
 * the same hour.
 */
async function focusOrLetTheTour(page: Page): Promise<void> {
  const focus = page.getByRole('button', { name: 'Focus', exact: true })
  const offer = page.getByRole('button', { name: 'Do it for me' })
  await expect(focus.or(offer)).toBeVisible()
  if (await focus.isVisible()) await focus.click()
  else await offer.click()
}
