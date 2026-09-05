import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, quickAdd, reopenAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The data's own doors: a backup out and back in around an erase, a
 * snapshot restored, a calendar file laid over the day. Each is a plain
 * mechanism - a download, a file chooser, IndexedDB - that jsdom either
 * lacks or fakes, so this is where they are seen to work.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
})

test('export, erase, import: the day comes back exactly', async ({ page }) => {
  await settings(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('dienius-backup.json')
  const path = await download.path()
  const backup = JSON.parse(readFileSync(path, 'utf8'))
  expect(backup.templates.map((t: { name: string }) => t.name)).toEqual(['Working day'])
  expect(Object.keys(backup.days)).toEqual(['2026-09-16'])

  // Two presses, the second on the armed button, then the app reloads empty.
  await page.getByRole('button', { name: 'Erase all data' }).click()
  await page.getByRole('button', { name: 'Confirm reset?' }).click()
  await page.getByRole('button', { name: 'Show me around' }).waitFor()
  await expect(page.getByRole('checkbox')).toHaveCount(0)

  await settings(page)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import backup' }).click(),
  ])
  await chooser.setFiles(path)
  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(9)
  await expect(page.getByRole('checkbox', { name: 'Standup' })).toBeAttached()
})

test('a snapshot from the first open of the day restores the app to that moment', async ({ page }) => {
  // The one snapshot so far was taken when the app first mounted, before the
  // stamp; restoring it is restoring an empty day.
  await settings(page)
  const row = page.getByRole('listitem').filter({ hasText: 'Today' }).filter({ hasText: '0 tasks, 0 templates' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Restore' }).click()
  await row.getByRole('button', { name: 'Replace everything?' }).click()

  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show me around' })).toBeVisible()
})

/**
 * The case the feature exists for, rather than the mechanism: a day was
 * built, an afternoon went wrong, and this morning's copy brings it back.
 *
 * The test above restores the empty snapshot the very first mount takes,
 * which proves the plumbing and nothing about the day. This one lets a
 * night pass first, so the snapshot taken on the new day's first open holds
 * yesterday whole - which is the window `snapshots.ts` describes as "a
 * short window in which a bad five minutes is recoverable".
 */
test('a snapshot taken this morning brings yesterday back after it is wrecked', async ({ page }) => {
  await quickAdd(page, '14:00 Ring the bank 15min')
  await quickAdd(page, '16:00 Physio 30min')
  const wednesday = '2026-09-16'

  // A night passes. The first open of the new day takes a snapshot, and
  // that copy holds Wednesday in full.
  await reopenAt(page, new Date(Date.UTC(2026, 8, 17, 8 - 3)))
  await page.waitForTimeout(600)

  // Now Wednesday is wrecked: every task on it deleted.
  await page.evaluate(date => {
    const data = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
    data.days[date].tasks = []
    localStorage.setItem('dienius:data', JSON.stringify(data))
  }, wednesday)
  await page.reload()
  await page.waitForSelector('nav')

  await settings(page)
  const row = page.getByRole('listitem').filter({ hasText: 'Today' }).first()
  await expect(row).toContainText('11 tasks')
  await row.getByRole('button', { name: 'Restore' }).click()
  await row.getByRole('button', { name: 'Replace everything?' }).click()
  await page.waitForTimeout(600)

  const back = await page.evaluate(date => {
    const data = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
    return (data.days[date]?.tasks ?? []).map((t: { title: string }) => t.title)
  }, wednesday)
  expect(back).toContain('Ring the bank')
  expect(back).toContain('Physio')
  expect(back).toContain('Get up, shower, coffee')
})

test('an imported .ics file lays its events over the day, and free time counts them', async ({ page }) => {
  await settings(page)
  await page.getByRole('button', { name: 'Calendars' }).click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import a .ics file' }).click(),
  ])
  await chooser.setFiles({ name: 'work.ics', mimeType: 'text/calendar', buffer: Buffer.from(WORK_ICS) })
  // Scoped to the calendar list rather than to any listitem saying "work":
  // the Settings page has a category row reading "Deep work" now, and the
  // loose selector matched both.
  const row = page.getByRole('list', { name: 'Calendars' }).getByRole('listitem').filter({ hasText: 'work' })
  await expect(row).toContainText('2 events - from a file, on this device only')

  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await expect(page.locator('.timeline-external-title', { hasText: 'Design review' })).toBeVisible()
  await expect(page.locator('.capacity-line')).toContainText('Calendar: 1h across 1 event.')
  // The all-day one is drawn nowhere and counted nowhere: it takes no time.
  await expect(page.locator('.timeline-external-title', { hasText: 'Offsite' })).toHaveCount(0)
})

async function settings(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
}

const WORK_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//dienius e2e//EN',
  'BEGIN:VEVENT',
  'UID:review@e2e',
  'SUMMARY:Design review',
  'DTSTART:20260916T140000',
  'DTEND:20260916T150000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:offsite@e2e',
  'SUMMARY:Offsite',
  'DTSTART;VALUE=DATE:20260917',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')
