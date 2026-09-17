import { expect, test } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exportJson, importJson } from './storage'
import { ensuredDay } from './ensureDay'
import { applyStamps } from './stamping'
import { addDays } from './dates'
import type { AppData, DayPlan } from './types'

/**
 * Rotating shifts must leave every plan that does not use them exactly as it
 * was - docs/RESEARCH-SHIFTS.md section 8.3. This is the plan such a person
 * has: a week template with its weekday overrides, a day template on the
 * weekday map, a day stamped and written on, a repeat, a block moved by hand
 * - generic names only - and what a month of opening it does to it, recorded
 * from the code as it stood before the feature's data was written (stage 2)
 * and compared day by day from then on.
 *
 * To record it again - only ever on purpose, and only when a change to how a
 * month stamps has been decided and written down in DECISIONS:
 * `RECORD_SHIFTS_GOLDEN=1 npx vitest run src/lib/shiftsMigration.test.ts`.
 */

const FIXTURES = join(__dirname, 'fixtures')
const BACKUP = readFileSync(join(FIXTURES, 'backup-weeks-before-shifts.json'), 'utf8')
const GOLDEN = join(FIXTURES, 'backup-weeks-before-shifts.golden.json')

/** The day the month is opened from: everything on and after it is ahead. */
const TODAY = '2026-10-01'

/** Opens every day of October and the first of November, the way the day view does. */
function openAMonth(data: AppData): AppData {
  let days = data.days
  for (let date = TODAY; date <= '2026-11-01'; date = addDays(date, 1)) {
    const ensured = ensuredDay({ ...data, days }, date, TODAY)
    if (ensured) days = ensured.days
  }
  // And two doors a person uses by hand: painting the day template over two
  // days in the month, and erasing a stamp.
  days = applyStamps(days, data.templates, { '2026-10-13': 'day-b', '2026-10-14': 'day-b', '2026-10-20': null }, data.library)
  return { ...data, days }
}

/** A day as it can be compared: task ids are minted fresh on every run, and everything else is kept. */
function comparable(day: DayPlan): unknown {
  const { tasks, updatedAt: _stamp, ...rest } = day
  return { ...rest, tasks: tasks.map(({ id: _id, updatedAt: _taskStamp, ...task }) => task) }
}

function month(data: AppData): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(data.days)
      .sort()
      .map(date => [date, comparable(data.days[date])]),
  )
}

test('an old backup with week templates, overrides and a weekday map opens a month exactly as it did before rotating shifts', () => {
  const opened = month(openAMonth(importJson(BACKUP)))
  if (process.env.RECORD_SHIFTS_GOLDEN === '1') {
    writeFileSync(GOLDEN, JSON.stringify(opened, null, 2) + '\n')
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Record<string, unknown>
  expect(Object.keys(opened)).toEqual(Object.keys(golden))
  for (const date of Object.keys(golden)) expect(opened[date], date).toEqual(golden[date])
})

test('the old backup exports back as the plan it imported, and a second pass changes nothing', () => {
  const once = importJson(BACKUP)
  const file = exportJson(once)
  expect(exportJson(importJson(file))).toBe(file)
  const original = JSON.parse(BACKUP) as AppData
  const exported = JSON.parse(file) as AppData
  expect(exported.templates).toEqual(original.templates)
  expect(exported.settings.weekdayTemplates).toEqual(original.settings.weekdayTemplates)
  expect(exported.settings.sleepProfiles).toEqual(original.settings.sleepProfiles)
  for (const date of Object.keys(original.days)) expect(exported.days[date]).toEqual(original.days[date])
})
