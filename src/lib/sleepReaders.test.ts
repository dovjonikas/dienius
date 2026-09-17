import { expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * One function in front of every reader of a date's sleep - rotating shifts,
 * stage 4, docs/RESEARCH-SHIFTS.md section 1.3. Before it, four readers
 * disagreed about a day on a week template: the day view, replan and the week
 * read the column's override, quick-add, Later and the task sheet read only the
 * template's own, and the set-aside strip read only the day's. Now `sleepOn` in
 * lib/shiftDay.ts answers for a date - its own choice, its kind or template
 * column, the weekday map for a date not yet opened, and tonight's schedule from
 * the next date - and this reads the source to keep it the only place that does.
 */

const SRC = resolve(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : []
  })
}

/** The words a file says, without what its comments say. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Where a day's own sleep choice may be read or written: the resolver, and the store that writes it. */
const ALLOWED = new Set(['lib/shiftDay.ts', 'lib/store/days.ts', 'lib/store/settings.ts'])

test("no file but the resolver works out a date's sleep for itself", () => {
  const offenders = sourceFiles(SRC)
    .map(file => ({ path: relative(SRC, file).replace(/\\/g, '/'), text: withoutComments(readFileSync(file, 'utf8')) }))
    .filter(file => !ALLOWED.has(file.path))
    .filter(file => /\b(day|plan|dayPlan|existing)\??\.sleepProfileId\b/.test(file.text) || /columnFor\([^)]*\)\.sleepProfileId/.test(file.text))
    .map(file => file.path)
  expect(offenders).toEqual([])
})
