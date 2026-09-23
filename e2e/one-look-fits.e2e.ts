import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * One look, rule 6 - it fits: on a desktop no page scrolls, what is long
 * scrolls inside its own box under the page's head; on a phone the page
 * scrolls only where its content is long, and nothing ever scrolls
 * sideways. Every screen of the app, with something on it, at 1920x1080 and
 * on a 375px phone. Every name here is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** How far the page reaches past the window, down and sideways. */
const past = (page: Page) =>
  page.evaluate(() => {
    const se = document.scrollingElement ?? document.documentElement
    return { down: Math.max(0, se.scrollHeight - innerHeight), sideways: Math.max(0, se.scrollWidth - innerWidth) }
  })

/** What the page's own body would scroll, where it has one. */
const bodyScroll = (page: Page) =>
  page.evaluate(() => {
    const body = document.querySelector('.page-body')
    return body ? body.scrollHeight - body.clientHeight : null
  })

/** Something on every page, made the way a person makes it. */
async function fill(page: Page) {
  await tab(page, 'Templates')
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('A working day')
  await page.getByRole('button', { name: 'Save template' }).click()

  await tab(page, 'Library')
  await page.getByRole('button', { name: 'Start a Books list' }).click()

  await tab(page, 'Kitchen')
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(['NAME: Lunch: a bean bowl', '400 kcal', 'INGREDIENTS', 'beans'].join('\n'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await tab(page, 'North')
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const lines = Array.from({ length: 40 }, (_, i) => (i % 5 === 0 ? `HEADING ${i}` : `A line of the picture, number ${i}.`))
  await page.getByRole('textbox', { name: 'North' }).fill(lines.join('\n'))
  await page.getByRole('textbox', { name: 'North' }).press('Control+Enter')
}

const SCREENS: [string, (page: Page) => Promise<void>][] = [
  ['Today', async page => tab(page, 'Today')],
  [
    'Calendar month',
    async page => {
      await tab(page, 'Calendar')
      await page.getByRole('button', { name: 'Month', exact: true }).click()
    },
  ],
  [
    'Calendar week',
    async page => {
      await tab(page, 'Calendar')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Grid', exact: true }).click()
    },
  ],
  [
    'Calendar agenda',
    async page => {
      await tab(page, 'Calendar')
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Agenda', exact: true }).click()
    },
  ],
  ['Templates', async page => tab(page, 'Templates')],
  [
    'Template editor',
    async page => {
      await tab(page, 'Templates')
      await page.getByRole('button', { name: 'Edit A working day' }).click()
    },
  ],
  ['Library', async page => tab(page, 'Library')],
  ['Kitchen', async page => tab(page, 'Kitchen')],
  ['North', async page => tab(page, 'North')],
  ['Review', async page => tab(page, 'Review')],
  ['Settings', async page => tab(page, 'Settings')],
]

test('on a desktop no page scrolls and a long page scrolls inside its own box; on a phone nothing scrolls sideways', async ({ page }, info) => {
  test.slow()
  const phone = info.project.name === 'phone'
  await openFreshAt(page, wednesdayAt(10))
  if (phone) await page.setViewportSize({ width: 375, height: 812 })
  else await page.setViewportSize({ width: 1920, height: 1080 })
  await fill(page)

  for (const [name, open] of SCREENS) {
    await open(page)
    await page.waitForTimeout(150)
    const reach = await past(page)
    expect(reach.sideways, `${name} scrolls sideways`).toBe(0)
    if (!phone) expect(reach.down, `${name} scrolls the page`).toBe(0)
  }

  if (!phone) {
    // Settings is the long page: its body scrolls, and the page does not.
    await tab(page, 'Settings')
    expect(await bodyScroll(page)).toBeGreaterThan(0)
    // The title stands where it stood, scrolled or not.
    const before = await page.getByRole('heading', { level: 2, name: 'Settings' }).boundingBox()
    await page.evaluate(() => document.querySelector('.page-body')!.scrollTo(0, 800))
    const after = await page.getByRole('heading', { level: 2, name: 'Settings' }).boundingBox()
    expect(after?.y).toBe(before?.y)
  }
})
