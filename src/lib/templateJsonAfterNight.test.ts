import { describe, expect, test } from 'vitest'
import { readTemplatesJson, templatesJson } from './templateJson'
import { defaultData } from './storage'
import { kindOnDate } from './dayKinds'
import type { AppData, Template } from './types'

/**
 * A kind after a night in the templates file - docs/TEMPLATE-JSON.md section
 * 2 and 5, and RESEARCH-SHIFTS section 2.6: `afterNight` on a template names,
 * by letter, the kind it is on a date after a night; the roster's preview
 * says which dates are read that way. Every name and date here is invented.
 */

const TODAY = '2030-01-01'

const FILE = {
  format: 'dienius-templates',
  version: 1,
  templates: [
    { name: 'Day shift', type: 'shift', kind: 'D', color: '#a7c4f5', blocks: [{ time: '07:00', title: 'Shift', minutes: 720, core: true }] },
    { name: 'Night shift', type: 'night', kind: 'N', color: '#c9b3f0', blocks: [{ time: '19:00', title: 'Shift', minutes: 720, core: true }] },
    { name: 'Rest day', type: 'rest', kind: 'L', afterNight: 'P', color: '#a7e3bd', blocks: [{ time: '09:00', title: 'Long breakfast', minutes: 45 }] },
    { name: 'After nights', type: 'rest', kind: 'P', color: '#f5d0a7', blocks: [{ time: '16:00', title: 'Late breakfast', minutes: 30 }] },
  ],
  roster: { '2030-01-07': 'N', '2030-01-08': 'N', '2030-01-09': 'L', '2030-01-10': 'L' },
}

const imported = (text: string, data: AppData = defaultData(), today = TODAY) => readTemplatesJson(text, data, today)
const named = (data: AppData, name: string) => data.templates.find(t => t.name === name) as Template

describe('a kind after a night', () => {
  test('afterNight names another kind by its letter, wherever in the file that kind comes, and the roster reads a rest day after a night as it', () => {
    const read = imported(JSON.stringify(FILE))
    expect(read.templates.flatMap(t => t.notes)).toEqual([])
    const rest = named(read.data, 'Rest day')
    expect(rest.dayKind).toMatchObject({ letter: 'L', afterNight: named(read.data, 'After nights').id })

    expect(['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-10'].map(d => kindOnDate(read.data, d)?.name)).toEqual([
      'Night shift',
      'Night shift',
      'After nights',
      'Rest day',
    ])
    expect(read.roster.map(r => [r.date, r.action, r.letter, r.kindName, r.note ?? ''])).toEqual([
      ['2030-01-07', 'set', 'N', 'Night shift', ''],
      ['2030-01-08', 'set', 'N', 'Night shift', ''],
      ['2030-01-09', 'set', 'P', 'After nights', 'Rest day after a night is After nights.'],
      ['2030-01-10', 'set', 'L', 'Rest day', ''],
    ])
  })

  test('the file comes back out with afterNight by letter, and reads again as itself', () => {
    const first = imported(JSON.stringify(FILE)).data
    const text = templatesJson(first, TODAY)
    expect(text).toContain('"kind": "L",\n      "afterNight": "P",')
    const again = imported(text, defaultData())
    expect(templatesJson(again.data, TODAY)).toBe(text)
    expect(again.templates.flatMap(t => t.notes)).toEqual([])
  })

  test('a letter no kind has, or the template itself, is said and left out; null takes it off', () => {
    const read = imported(
      JSON.stringify({
        templates: [
          { name: 'Rest day', kind: 'L', afterNight: 'X', blocks: [] },
          { name: 'Night shift', type: 'night', kind: 'N', afterNight: 'N', blocks: [] },
          { name: 'Odd', kind: 'O', afterNight: 3, blocks: [] },
        ],
      }),
    )
    expect(read.templates.map(t => [t.name, t.notes])).toEqual([
      ['Rest day', ['afterNight "X" names no kind of day - left out.']],
      ['Night shift', ['afterNight "N" is this template itself - left out.']],
      ['Odd', ['afterNight 3 is not a letter - left out.']],
    ])
    expect(named(read.data, 'Rest day').dayKind).toEqual({ letter: 'L', order: 0 })

    const start = imported(JSON.stringify(FILE)).data
    const off = imported(JSON.stringify({ templates: [{ name: 'Rest day', afterNight: null }] }), start)
    expect(off.templates.map(t => [t.name, t.action, t.notes])).toEqual([['Rest day', 'update', []]])
    expect(named(off.data, 'Rest day').dayKind).toEqual({ letter: 'L', order: 2 })
    // Said once more, the same file changes nothing.
    const same = imported(JSON.stringify(FILE), start)
    expect(same.templates.map(t => t.action)).toEqual(['unchanged', 'unchanged', 'unchanged', 'unchanged'])
  })

  test('a night written before a rest day the plan already has turns that day too, and the preview lists it', () => {
    const start = imported(JSON.stringify({ ...FILE, roster: { '2030-01-08': 'D', '2030-01-09': 'L' } })).data
    expect(kindOnDate(start, '2030-01-09')?.name).toBe('Rest day')

    const read = imported(JSON.stringify({ roster: { '2030-01-08': 'N' } }), start)
    expect(read.roster.map(r => [r.date, r.action, r.letter, r.note ?? ''])).toEqual([
      ['2030-01-08', 'set', 'N', ''],
      ['2030-01-09', 'set', 'P', 'Rest day after a night is After nights.'],
    ])
    expect(kindOnDate(read.data, '2030-01-09')?.name).toBe('After nights')

    const back = imported(JSON.stringify({ roster: { '2030-01-08': 'D' } }), read.data)
    expect(back.roster.map(r => [r.date, r.action, r.letter, r.note ?? ''])).toEqual([
      ['2030-01-08', 'set', 'D', ''],
      ['2030-01-09', 'set', 'L', 'No night before it now, so Rest day again.'],
    ])
  })
})
