import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, quickAdd, wednesdayAt } from './app'

/**
 * The free hunt of the owner's shift brief of 2026-09-25, stage 7: the
 * things nobody had looked for - a double press, a sheet open while the plan
 * changes under it from another tab, a note far longer than anybody writes.
 * Each walk here held on the first try; they are kept so that stays so.
 * Every title is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

const FILE = (letter: string) =>
  JSON.stringify({
    templates: [
      { name: 'Early', kind: 'E', blocks: [{ time: '20:00', title: 'Early walk', minutes: 30 }] },
      { name: 'Late', kind: 'L', blocks: [{ time: '21:00', title: 'Late read', minutes: 30 }] },
    ],
    roster: { '2026-09-16': letter },
  })

async function importFile(page: Page, text: string) {
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(text)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()
}

test('a task sheet open while another tab imports a file that takes its task away closes by itself, and the page goes on', async ({ context, page }, info) => {
  test.skip(info.project.name !== 'desktop', 'two tabs are a desktop thing')
  await openFreshAt(page, wednesdayAt(10))
  await importFile(page, FILE('E'))
  await tab(page, 'Today')
  await page.getByRole('button', { name: 'More actions for Early walk' }).first().click()
  await page.getByRole('button', { name: /Details/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Another tab puts the other kind on today: the walk goes, the read comes.
  const other = await context.newPage()
  await other.clock.setFixedTime(wednesdayAt(10, 1))
  await other.goto('./')
  await importFile(other, FILE('L'))

  // The first tab took it in: its sheet for a task that is no more has gone, and the day says the new kind.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Late read', exact: true })).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Early walk', exact: true })).toHaveCount(0)
  await quickAdd(page, 'Still works')
  await expect(page.getByRole('checkbox', { name: 'Still works', exact: true })).toBeAttached()
})

test('a note of five thousand characters with no space in it is read on the day, and nothing scrolls sideways', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  await quickAdd(page, 'A long one')
  const long = 'a'.repeat(5000)
  await page.evaluate(note => {
    const data = JSON.parse(localStorage.getItem('dienius:data')!) as { days: Record<string, { tasks: { title: string; note?: string; noteExpanded?: boolean }[] }> }
    for (const day of Object.values(data.days)) for (const t of day.tasks) if (t.title === 'A long one') Object.assign(t, { note, noteExpanded: true })
    localStorage.setItem('dienius:data', JSON.stringify(data))
  }, long)
  await page.reload()
  await expect(page.getByText(long.slice(0, 40), { exact: false }).first()).toBeAttached()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('a title of three hundred characters with no space in it - a task, a recipe - pushes nothing sideways either', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })
  const long = 'b'.repeat(300)
  await quickAdd(page, long)
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(await sideways()).toBeLessThanOrEqual(0)
  await tab(page, 'Kitchen')
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(`NAME: ${long}\n300 kcal`)
  expect(await sideways()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(await sideways()).toBeLessThanOrEqual(0)
})

test('a double press does what one press does: Apply once, Add a block once', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE('E'))
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).dblclick()
  const kinds = await page.evaluate(() => (JSON.parse(localStorage.getItem('dienius:data')!) as { templates: { name: string }[] }).templates.map(t => t.name))
  expect(kinds).toEqual(['Early', 'Late'])

  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'Edit Early' }).click()
  await page.getByPlaceholder('09:00').fill('07:00')
  await page.getByPlaceholder('What happens').fill('Stretch')
  await page.getByRole('button', { name: 'Add a block' }).dblclick()
  await page.getByRole('button', { name: 'Save template' }).click()
  const blocks = await page.evaluate(() => (JSON.parse(localStorage.getItem('dienius:data')!) as { templates: { name: string; blocks: { title: string }[] }[] }).templates.find(t => t.name === 'Early')!.blocks.map(b => b.title))
  expect(blocks.filter(title => title === 'Stretch')).toHaveLength(1)
  expect(blocks).toContain('Early walk')
})
