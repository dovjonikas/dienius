import { expect, test, type Page } from '@playwright/test'
import { openFreshAt } from './app'

/**
 * A kind after a night, walked end to end on a desktop and a 375px phone -
 * v2.40, docs/RESEARCH-SHIFTS.md section 2.6. A templates file whose rest day
 * names the kind it is after a night is pasted and previewed: the rest day
 * written after two nights reads as the after-nights kind, and the preview
 * says so. Applied, the date is that kind. Then the last night is made a day
 * shift by hand, and the date after it is a rest day again; made a night
 * again, it is the after-nights kind again. Every name and date is invented.
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
      { name: 'Day shift', type: 'shift', kind: 'D', blocks: [{ time: '07:00', title: 'Shift', minutes: 720, category: 'Deep work', core: true }] },
      {
        name: 'Night shift',
        type: 'night',
        kind: 'N',
        sleep: { from: '08:30', to: '15:30' },
        blocks: [
          { time: '19:00', title: 'Shift', minutes: 720, category: 'Deep work', core: true },
          { time: '07:15', title: 'Travel home', minutes: 45, category: 'Commute', afterMidnight: true },
        ],
      },
      { name: 'Rest day', type: 'rest', kind: 'L', afterNight: 'P', blocks: [{ time: '09:00', title: 'Long breakfast', minutes: 45, category: 'Meals' }] },
      { name: 'After nights', type: 'rest', kind: 'P', blocks: [{ time: '16:00', title: 'Late breakfast', minutes: 30, category: 'Meals' }] },
    ],
    roster: { '2026-09-17': 'N', '2026-09-18': 'N', '2026-09-19': 'L', '2026-09-20': 'L' },
  },
  null,
  2,
)

/** The name of the template stamped on a date, read off the plan. */
async function kindOn(page: Page, date: string): Promise<string | undefined> {
  return page.evaluate(date => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const id = data.days?.[date]?.templateId
    return (data.templates as { id: string; name: string }[]).find(t => t.id === id)?.name
  }, date)
}

/** A kind put on a date by hand, from the month's stamp bar. */
async function stampByHand(page: Page, date: string, kind: string) {
  await tab(page, 'Calendar')
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  const roster = page.getByRole('button', { name: 'Roster', exact: true })
  if ((await roster.getAttribute('aria-pressed')) === 'true') await roster.click()
  await page.locator('.stamp-bar').getByRole('button', { name: kind }).click()
  await page.locator(`[data-date="${date}"]`).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

test('a rest day after two nights is the after-nights kind, said first and stamped so, and follows the night before it by hand', async ({ page }, info) => {
  test.slow()
  await openFreshAt(page, WEDNESDAY_NINE)
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })

  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  const dates = page.getByRole('list', { name: 'Dates in the file' }).getByRole('listitem')
  await expect(dates).toHaveCount(4)
  await expect(dates.nth(2)).toContainText('P, After nights')
  await expect(dates.nth(2)).toContainText('Rest day after a night is After nights.')
  await expect(dates.nth(3)).toContainText('L, Rest day')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()

  expect(await kindOn(page, '2026-09-18')).toBe('Night shift')
  expect(await kindOn(page, '2026-09-19')).toBe('After nights')
  expect(await kindOn(page, '2026-09-20')).toBe('Rest day')

  // The last night made a day shift by hand: the day after it is a rest day again.
  await stampByHand(page, '2026-09-18', 'Day shift')
  expect(await kindOn(page, '2026-09-18')).toBe('Day shift')
  expect(await kindOn(page, '2026-09-19')).toBe('Rest day')

  // And a night again: the after-nights kind again, with the night's journey home on its morning.
  await stampByHand(page, '2026-09-18', 'Night shift')
  expect(await kindOn(page, '2026-09-19')).toBe('After nights')
  const morning = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return (data.days['2026-09-19'].tasks as { title: string; nightOf?: string }[]).map(t => [t.title, t.nightOf ?? '']).sort()
  })
  expect(morning).toEqual([
    ['Late breakfast', ''],
    ['Travel home', '2026-09-18'],
  ])
})
