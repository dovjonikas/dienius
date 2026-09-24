import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, reopenAt, tick, wednesdayAt } from './app'

/**
 * The templates file pasted again, the next day - the owner's shift brief of
 * 2026-09-25, stage 2 - on a desktop and a 375px phone. The file comes on
 * Wednesday; Wednesday is lived with a block ticked; on Thursday afternoon
 * the file comes again with the day shift changed. Wednesday stays as it was
 * lived, Thursday is cut at now, Friday follows the file, and the same file
 * a third time has nothing to do. Every name here is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

const WEDNESDAY = '2026-09-16'
const THURSDAY = '2026-09-17'
const FRIDAY = '2026-09-18'

function file(blocks: object[]): string {
  return JSON.stringify({
    templates: [{ name: 'Day shift', type: 'shift', kind: 'D', blocks }],
    roster: { [WEDNESDAY]: 'D', [THURSDAY]: 'D', [FRIDAY]: 'D' },
  })
}

const FIRST = [
  { time: '06:00', title: 'Travel in', minutes: 45 },
  { time: '12:00', title: 'Lunch', minutes: 30 },
  { time: '15:00', title: 'Coffee', minutes: 15 },
  { time: '19:30', title: 'Travel home', minutes: 45 },
]

/** Travel in a quarter earlier, Coffee renamed Tea, Travel home gone, Stretch new. */
const SECOND = [
  { time: '05:45', title: 'Travel in', minutes: 45 },
  { time: '12:00', title: 'Lunch', minutes: 30 },
  { time: '15:00', title: 'Tea', minutes: 15 },
  { time: '20:30', title: 'Stretch', minutes: 15 },
]

/** Vilnius, on the Thursday, at an hour. */
const thursdayAt = (hours: number) => new Date(Date.UTC(2026, 8, 17, hours - 3, 0))

async function paste(page: Page, text: string) {
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(text)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
}

/** A date's tasks as the browser holds them: time, title and whether ticked, in order. */
async function day(page: Page, date: string): Promise<string[]> {
  const days = await page.evaluate(() => JSON.parse(localStorage.getItem('dienius:data') || '{}').days as Record<string, { tasks: { time?: string; title: string; done?: boolean }[] }>)
  return (days[date]?.tasks ?? []).map(t => `${t.time ?? '--:--'} ${t.title}${t.done ? ' (ticked)' : ''}`).sort()
}

test('pasted again the next day: yesterday as it was lived, today cut at now, tomorrow the new file, and a third paste has nothing to do', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(8))
  if (info.project.name === 'phone') await page.setViewportSize({ width: 375, height: 812 })

  await paste(page, file(FIRST))
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  // Wednesday, lived: Lunch ticked.
  await tab(page, 'Today')
  await tick(page, 'Lunch')
  const wednesday = await day(page, WEDNESDAY)
  expect(wednesday).toContain('12:00 Lunch (ticked)')

  // Thursday at one in the afternoon: Travel home ticked early, then the file again.
  await reopenAt(page, thursdayAt(13))
  await tab(page, 'Today')
  await tick(page, 'Travel home')
  await paste(page, file(SECOND))
  await expect(page.getByText(/2 dates ahead refreshed, 1 past date untouched, 1 ticked block kept\.$/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  // Wednesday is as it was lived; Thursday keeps what has ended and follows
  // the file from now on; Friday is the new file.
  expect(await day(page, WEDNESDAY)).toEqual(wednesday)
  expect(await day(page, THURSDAY)).toEqual(['06:00 Travel in', '12:00 Lunch', '15:00 Tea', '19:30 Travel home (ticked)', '20:30 Stretch'])
  expect(await day(page, FRIDAY)).toEqual(['05:45 Travel in', '12:00 Lunch', '15:00 Tea', '20:30 Stretch'])

  // The same file once more: nothing to do, so nothing to apply.
  await paste(page, file(SECOND))
  await expect(page.getByText(/^1 unchanged template\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled()
})
