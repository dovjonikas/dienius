import { describe, expect, it } from 'vitest'
import type { AppData, Task } from '../../lib/types'
import { defaultData } from '../../lib/storage'
import { todayKey } from '../../lib/dates'
import { nextSlotFor } from './laterSlot'

const DATE = '2026-09-01'

function task(partial: Partial<Task> & { title: string }): Task {
  return { id: partial.title, done: false, ...partial }
}

function withTasks(tasks: Task[], date = DATE, over: Partial<AppData['days'][string]> = {}): AppData {
  const data = defaultData()
  data.days[date] = { date, tasks, ...over }
  return data
}

/**
 * Where a thing pulled out of Later lands. One piece of arithmetic for the
 * day view's press and the week's drop, so both put the item where the day
 * genuinely has room - the same answer quick-add's time control opens on.
 * The pure function is tested here; what each screen does with the answer
 * is in Later.test.tsx and WeekAgenda.test.tsx.
 */
describe('where a pulled item lands', () => {
  it('starts the day when there is nothing on it', () => {
    expect(nextSlotFor({ data: defaultData(), date: DATE, minutes: 30, busy: [] })).toBe('07:00')
  })

  it('goes round what is already on the day', () => {
    const data = withTasks([task({ title: 'Standup', time: '07:00', minutes: 60 })])
    expect(nextSlotFor({ data, date: DATE, minutes: 45, busy: [] })).toBe('08:00')
  })

  it('goes round what an external calendar already holds', () => {
    // A meeting from a subscribed calendar is not a task, but it is time
    // spoken for, and landing on top of it is the drop the week used to do.
    expect(nextSlotFor({ data: defaultData(), date: DATE, minutes: 30, busy: [{ start: 7 * 60, end: 9 * 60 }] })).toBe('09:00')
  })

  it('gives an unsized item half an hour to find room for', () => {
    const data = withTasks([task({ title: 'Standup', time: '07:00', minutes: 20 })])
    // A twenty-minute block leaves 07:20; the gap it opens holds thirty.
    expect(nextSlotFor({ data, date: DATE, busy: [] })).toBe('07:20')
  })

  it('answers with nothing on a day with no gap that holds it, so the item lands as a float', () => {
    const data = withTasks([task({ title: 'All day', time: '07:00', minutes: 16 * 60 })])
    expect(nextSlotFor({ data, date: DATE, minutes: 30, busy: [] })).toBeUndefined()
  })

  it('never answers before now on today, and ignores the clock on any other day', () => {
    const today = todayKey()
    const noon = 12 * 60
    expect(nextSlotFor({ data: defaultData(), date: today, minutes: 30, busy: [], nowMinutes: noon })).toBe('12:00')
    // Another day has no honest "now": the clock is passed and not honoured.
    expect(nextSlotFor({ data: defaultData(), date: DATE, minutes: 30, busy: [], nowMinutes: noon })).toBe('07:00')
  })

  it('measures against the sleep schedule the day points at, or the one its template does', () => {
    const data = withTasks([], DATE, { sleepProfileId: 'nights' })
    data.settings.sleepProfiles = [
      ...data.settings.sleepProfiles,
      { id: 'nights', name: 'Nights', window: { start: '10:00', end: '18:00' } },
    ]
    expect(nextSlotFor({ data, date: DATE, minutes: 30, busy: [] })).toBe('18:00')

    const viaTemplate = withTasks([], DATE, { templateId: 'shift' })
    viaTemplate.settings.sleepProfiles = data.settings.sleepProfiles
    viaTemplate.templates = [{ id: 'shift', name: 'Shift', color: '#a7c4f5', blocks: [], sleepProfileId: 'nights' }]
    expect(nextSlotFor({ data: viaTemplate, date: DATE, minutes: 30, busy: [] })).toBe('18:00')
  })
})
