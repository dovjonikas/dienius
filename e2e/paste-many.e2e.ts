import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A whole shelf pasted into the Library, and a whole North text put in the
 * place of the one there - the owner's brief of 2026-09-22, part 4 - on a
 * desktop and on a 375px phone, where both pages have to fit. Every title
 * and line here is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** How far the page reaches past the window sideways: nothing, ever. */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('a shelf pasted at once makes its lists and its books, and a North text is replaced with what it will make said first', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })

  // The Library: one list started, then the shelf pasted over it.
  await tab(page, 'Library')
  await page.getByRole('button', { name: 'Start a Books list' }).click()
  await page.getByRole('button', { name: 'Paste many' }).click()
  const books = page.getByRole('textbox', { name: 'Books' })
  await books.fill(['A long walk - A Walker', 'A second book', 'SIDE', 'A short one - Another Name'].join('\n'))
  const rows = page.getByRole('list', { name: 'What Save will do' }).getByRole('listitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(2)).toContainText('Side')
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { level: 2, name: 'Library' })).toBeVisible()
  await expect(page.getByText('A Walker')).toBeVisible()
  const lists = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return (data.library as { name: string; items: { title: string; author?: string }[] }[]).map(l => [l.name, l.items.map(i => i.title)])
  })
  expect(lists).toEqual([
    ['Books', ['A long walk', 'A second book']],
    ['Side', ['A short one']],
  ])

  // North: a text written, then a whole new one put in its place.
  await tab(page, 'North')
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  await page.getByRole('textbox', { name: 'North' }).fill('THE OLD HEADING\nA line under it.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Replace text' }).click()
  await page.getByRole('textbox', { name: 'The whole text' }).fill(['A first line.', '', 'WHAT MATTERS [morning]', 'A line.', '', 'THE EVENING [evening]', 'Another.'].join('\n'))
  const found = page.getByRole('list', { name: 'What it will make' })
  await expect(found).toContainText('2 headings: WHAT MATTERS, THE EVENING')
  await expect(found).toContainText('For the morning: WHAT MATTERS')
  await expect(found).toContainText('For the evening: THE EVENING')
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Replace what is here' }).click()
  await expect(page.getByRole('heading', { name: 'WHAT MATTERS' })).toBeVisible()
  await expect(page.getByText('THE OLD HEADING')).toHaveCount(0)
})
