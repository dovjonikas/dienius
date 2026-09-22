import { expect, test, type Page } from '@playwright/test'
import { openFreshAt } from './app'

/**
 * Templates and the roster as JSON, walked end to end on both screens -
 * v2.33, docs/TEMPLATE-JSON.md. A text another agent could have written is
 * pasted into Settings on a 375px phone and on the desktop, previewed with
 * nothing reaching past the screen, and applied: the templates are there,
 * and the night's meal after midnight is on the morning after, marked as
 * last night's. Export gives the same format back, with the roster from today
 * on. Every template and date here is an invented one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Wednesday 16 September 2026, nine in the morning. */
const WEDNESDAY_NINE = new Date(Date.UTC(2026, 8, 16, 6, 0))

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

const FILE = JSON.stringify(
  {
    format: 'dienius-templates',
    version: 1,
    templates: [
      {
        name: 'Day shift',
        type: 'shift',
        kind: 'D',
        blocks: [{ time: '07:00', title: 'Shift', minutes: 600, category: 'Deep work', core: true }],
      },
      {
        name: 'Night shift',
        type: 'night',
        kind: 'N',
        blocks: [
          { time: '21:00', title: 'Shift', minutes: 600, category: 'Deep work', core: true },
          { time: '01:00', title: 'Night meal', minutes: 30, category: 'Meals', afterMidnight: true, mealType: 'dinner', recipes: ['A bean bowl'] },
        ],
      },
      { name: 'Rest day', type: 'rest', kind: 'R', blocks: [{ time: '10:00', title: 'Something outside', minutes: 60 }] },
    ],
    roster: { '2026-09-17': 'D', '2026-09-18': 'N', '2026-09-19': 'R', '2026-09-20': 'Q' },
  },
  null,
  2,
)

/** How far the page reaches past the window sideways: nothing, ever. */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test('a pasted file is previewed inside the screen, applied, and its night lands on the morning after', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  await openFreshAt(page, WEDNESDAY_NINE)
  if (phone) await page.setViewportSize({ width: 375, height: 812 })
  await tab(page, 'Settings')

  const field = page.getByRole('textbox', { name: 'Templates and roster as JSON' })
  await field.fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.getByText('3 new templates. 3 dates set, 1 skipped.')).toBeVisible()
  const skipped = page.getByRole('list', { name: 'Dates in the file' }).getByRole('listitem').filter({ hasText: '2026-09-20' })
  await expect(skipped).toContainText('No kind of day has the letter or name "Q".')
  // The meal names a recipe Kitchen has not got yet: the block waits for it.
  await expect(page.getByText(/Night meal: no recipe called "A bean bowl" in Kitchen yet/)).toBeVisible()

  // The field, the rows and their notes inside the screen, and nothing sideways.
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  const out = await page.locator('.template-json-text, .template-json-row, .template-json-actions > *').evaluateAll(els =>
    els.filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map(el => el.className),
  )
  expect(out).toEqual([])

  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\. 3 new templates/)).toBeVisible()

  // The templates are there, each with its letter.
  await tab(page, 'Templates')
  for (const name of ['Day shift', 'Night shift', 'Rest day']) await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible()

  // Saturday morning holds Friday night's meal, marked as last night's: in
  // the rail's month on a desktop, three days on by the arrows on a phone.
  await tab(page, 'Today')
  const saturday = page.locator('.mini-calendar [data-date="2026-09-19"]')
  if (await saturday.isVisible().catch(() => false)) await saturday.click()
  else for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next day' }).click()
  const meal = page.getByRole('checkbox', { name: 'Night meal', exact: true }).locator('xpath=ancestor::li[1]')
  await expect(meal).toContainText('01:00')
  await expect(meal).toContainText('last night')

  // The recipe is written afterwards, the way a week is pasted before its
  // cooking, and the block that was waiting takes it by name.
  await tab(page, 'Kitchen')
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(['NAME: A bean bowl', '400 kcal', 'INGREDIENTS', 'beans'].join('\n'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'Edit Night shift' }).click()
  await expect(page.getByRole('button', { name: /^Recipes for Night meal: / })).toHaveAccessibleName('Recipes for Night meal: A bean bowl')

  // Export gives the same format back, with the roster from today on.
  await tab(page, 'Settings')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const exported = await page.getByRole('textbox', { name: 'The templates and roster, as JSON' }).inputValue()
  expect(JSON.parse(exported)).toMatchObject({
    format: 'dienius-templates',
    version: 1,
    roster: { '2026-09-17': 'D', '2026-09-18': 'N', '2026-09-19': 'R' },
  })
  expect(JSON.parse(exported).templates.map((t: { name: string }) => t.name)).toEqual(['Day shift', 'Night shift', 'Rest day'])
})
