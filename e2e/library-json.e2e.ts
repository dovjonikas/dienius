import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A reading block bound to a Library list by the list's name, through the
 * templates file - the extra stage of the shift brief of 2026-09-25,
 * docs/TEMPLATE-JSON.md's `library` - on a desktop and a 375px phone. A
 * shelf pasted into the Library, a file naming its list pasted into
 * Settings, today's reading block naming the list's book; the book finished,
 * and tomorrow's reading block naming the next one. Every title here is
 * invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** Wednesday 16 September 2026 and the day after, the two dates of the file's roster. */
const TODAY = '2026-09-16'
const TOMORROW = '2026-09-17'

const FILE = JSON.stringify({
  templates: [{ name: 'An evening', kind: 'E', blocks: [{ time: '21:00', title: 'Read', minutes: 30, library: 'MAIN' }] }],
  roster: { [TODAY]: 'E', [TOMORROW]: 'E' },
})

/** Tomorrow on Today: the month beside the day on a desktop, the arrow on a phone. */
async function tomorrow(page: Page) {
  const cell = page.locator(`.mini-calendar [data-date="${TOMORROW}"]`)
  if (await cell.isVisible().catch(() => false)) await cell.click()
  else await page.getByRole('button', { name: 'Next day' }).click()
}

test('a shelf pasted, then a file naming its list: today reads its book, and with the book finished tomorrow reads the next', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })

  // The shelf, on an empty Library: a list in capitals and two books under it.
  await tab(page, 'Library')
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Books' }).fill(['MAIN', 'A first book - An author', 'A second book - Another author'].join('\n'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: /^A first book, / })).toBeVisible()

  // The templates file: the preview says which list the block reads from, and the book on it now.
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.getByText('Read reads from Main: A first book')).toBeVisible()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  // Today's reading block is the book.
  await tab(page, 'Today')
  await expect(page.getByRole('checkbox', { name: 'A first book', exact: true })).toBeAttached()

  // The book finished, from its own panel: one chapter long, and that chapter read.
  await tab(page, 'Library')
  await page.getByRole('button', { name: /^A first book, / }).click()
  await page.getByRole('textbox', { name: 'Out of' }).fill('1')
  await page.getByRole('textbox', { name: 'Out of' }).press('Tab')
  await page.getByRole('button', { name: 'One more chapter of A first book' }).click()
  await expect(page.getByRole('button', { name: 'Finished (1)' })).toBeVisible()

  // Tomorrow's reading block is the next book.
  await tab(page, 'Today')
  await tomorrow(page)
  await expect(page.getByRole('checkbox', { name: 'A second book', exact: true })).toBeAttached()
  const days = await page.evaluate(() => JSON.parse(localStorage.getItem('dienius:data') || '{}').days as Record<string, { tasks: { title: string; libraryRef?: unknown }[] }>)
  expect(days[TOMORROW].tasks.filter(t => t.libraryRef).map(t => t.title)).toEqual(['A second book'])
})
