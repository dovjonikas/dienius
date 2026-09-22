import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exportJson, importJson } from './storage'
import { ensuredDay } from './ensureDay'
import { addDays } from './dates'
import { BACKUP_SHAPES } from './validate'
import type { AppData, DayPlan } from './types'

/**
 * The backup's contract - docs/BACKUP-FORMAT.md. What a program reading a
 * Dienius backup can rely on, held to the code in three ways: the document
 * writes down every field the app's own guard knows, a backup recorded by the
 * version before v2.31 imports and exports again byte for byte, and opening
 * its month does exactly what that version's opening did.
 *
 * The backup and its opened month were recorded once, by the code as it stood
 * at 24f5099 - four weeks of a rota (day, night, after nights, rest), two
 * routines, recipes on meal blocks, a reading block, a weekday map, a ticked
 * block, a task written by hand and a journal line. Every name in it is a
 * generic one.
 */

const FIXTURES = join(__dirname, 'fixtures')
const BACKUP = readFileSync(join(FIXTURES, 'backup-v2.30-rota.json'), 'utf8')
const GOLDEN = JSON.parse(readFileSync(join(FIXTURES, 'backup-v2.30-rota.golden.json'), 'utf8')) as Record<string, unknown>
const CONTRACT = readFileSync(join(__dirname, '../../docs/BACKUP-FORMAT.md'), 'utf8')

/** The day it was recorded on, which the month was opened from. */
const TODAY = '2026-09-22'

test('a backup from before v2.31 imports and exports again byte for byte', () => {
  expect(exportJson(importJson(BACKUP))).toBe(BACKUP)
})

/** A day as it can be compared: ids are minted fresh on every run. */
function comparable(day: DayPlan): unknown {
  const { tasks, updatedAt: _stamp, ...rest } = day
  return { ...rest, tasks: tasks.map(({ id: _id, updatedAt: _taskStamp, ...task }) => task) }
}

test('opening five weeks of it does exactly what opening them did before v2.31', () => {
  const data: AppData = importJson(BACKUP)
  let days = data.days
  for (let date = TODAY; date <= addDays(TODAY, 34); date = addDays(date, 1)) {
    const ensured = ensuredDay({ ...data, days }, date, TODAY)
    if (ensured) days = ensured.days
  }
  const opened = Object.fromEntries(Object.keys(days).sort().map(date => [date, comparable(days[date])]))
  expect(Object.keys(opened)).toEqual(Object.keys(GOLDEN))
  for (const date of Object.keys(GOLDEN)) expect(opened[date], date).toEqual(GOLDEN[date])
})

/** The part of the document under a shape's own heading. */
function section(name: string): string {
  const start = CONTRACT.indexOf(`\n### ${name}\n`)
  if (start < 0) return ''
  const rest = CONTRACT.slice(start + name.length + 6)
  const end = rest.search(/\n##+ /)
  return end < 0 ? rest : rest.slice(0, end)
}

test('the contract writes down every field the guard knows, each under its shape', () => {
  for (const [name, shape] of Object.entries(BACKUP_SHAPES)) {
    const written = section(name)
    expect(written, `docs/BACKUP-FORMAT.md has no "### ${name}"`).not.toBe('')
    for (const field of shape.fields) expect(written, `${name}.${field}`).toContain(`| \`${field}\` |`)
  }
})

test("the contract marks v2.31's two fields where they are", () => {
  expect(section('TemplateBlock')).toMatch(/\| `afterMidnight` \| \*\*v2\.31\.\*\*/)
  expect(section('Task')).toMatch(/\| `nightOf` \| \*\*v2\.31\.\*\*/)
})

test('the recorded backup is one a program can read with nothing but the contract: a rota, and no v2.31 field', () => {
  const data = JSON.parse(BACKUP) as AppData
  const kinds = data.templates.filter(t => t.dayKind).map(t => t.dayKind!.letter)
  expect(kinds).toEqual(['D', 'N', 'A', 'R'])
  expect(Object.keys(data.days)).toHaveLength(28)
  expect(BACKUP).not.toContain('afterMidnight')
  expect(BACKUP).not.toContain('nightOf')
})
