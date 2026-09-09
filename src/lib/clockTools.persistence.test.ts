import { beforeEach, expect, test, vi } from 'vitest'
import { clockTools, elapsedMs, getClockTools, loadClockTools, remainingMs } from './clockTools'

beforeEach(() => {
  localStorage.clear()
  clockTools.resetForTests()
  vi.useRealTimers()
})

/**
 * The timer is stored as an instant plus a duration, never as a countdown
 * that has to keep being decremented. That is the whole reason it survives a
 * reload, a backgrounded tab and a laptop lid - there is nothing to keep
 * ticking, only arithmetic to redo. These are the tests that say so.
 */

test('a timer survives being reloaded, and has run for the time that actually passed', () => {
  const started = Date.now() - 60_000
  clockTools.resetForTests({
    timer: { startedAt: started, durationMs: 5 * 60_000, elapsedBeforeMs: 0, paused: false },
    stopwatch: null,
    focus: null,
    corner: 'bottom-right',
  })
  // Loading is what a reload does: read the same stored shape back.
  const loaded = loadClockTools()
  expect(loaded.timer).toBeTruthy()
  expect(Math.round(remainingMs(loaded.timer!, started + 60_000) / 1000)).toBe(4 * 60)
})

test('a timer that ran out while the tab was closed comes back already finished', () => {
  const started = Date.now() - 10 * 60_000
  clockTools.resetForTests({
    timer: { startedAt: started, durationMs: 5 * 60_000, elapsedBeforeMs: 0, paused: false },
    stopwatch: null,
    focus: null,
    corner: 'bottom-right',
  })
  expect(remainingMs(loadClockTools().timer!, Date.now())).toBeLessThan(0)
})

test('pausing banks the time already spent and stops the clock', () => {
  clockTools.startTimer(5 * 60_000)
  const t0 = getClockTools().timer!.startedAt
  clockTools.pauseTimer()
  const paused = getClockTools().timer!
  expect(paused.paused).toBe(true)
  // A paused timer reads the same however much later it is asked.
  expect(elapsedMs(paused, t0 + 60_000)).toBe(paused.elapsedBeforeMs)
  expect(elapsedMs(paused, t0 + 600_000)).toBe(paused.elapsedBeforeMs)
})

test('resuming counts from now, not from when it first started', () => {
  clockTools.startTimer(5 * 60_000)
  clockTools.pauseTimer()
  const banked = getClockTools().timer!.elapsedBeforeMs
  clockTools.resumeTimer()
  const resumed = getClockTools().timer!
  expect(resumed.paused).toBe(false)
  expect(resumed.elapsedBeforeMs).toBe(banked)
  expect(elapsedMs(resumed, resumed.startedAt + 30_000)).toBe(banked + 30_000)
})

test('a timer of no length is refused rather than finishing instantly', () => {
  clockTools.startTimer(0)
  expect(getClockTools().timer ?? undefined).toBeUndefined()
})

// The chime is per run, not per load: a reload finds rungOut already set and
// shows the finished state silently rather than alarming about something
// that happened an hour ago.
test('a run that already chimed is marked, and the mark survives a reload', () => {
  clockTools.startTimer(1)
  clockTools.markRungOut()
  expect(getClockTools().timer!.rungOut).toBe(true)
  expect(loadClockTools().timer!.rungOut).toBe(true)
})

test('a stopwatch is the same arithmetic with no deadline', () => {
  clockTools.startStopwatch()
  const sw = getClockTools().stopwatch!
  expect(elapsedMs(sw, sw.startedAt + 90_000)).toBe(90_000)
})

// Clock state is deliberately its own storage key and never part of a
// backup - a timer restored from a file written last week is nonsense.
test('the clock is not stored in the app data key', () => {
  clockTools.startTimer(60_000)
  expect(localStorage.getItem('dienius:data')).toBeNull()
  expect(localStorage.getItem('dienius:clock-tools')).toBeTruthy()
})

test('a corrupt clock payload loads as nothing running rather than throwing', () => {
  localStorage.setItem('dienius:clock-tools', '{ not json')
  expect(() => loadClockTools()).not.toThrow()
  expect(loadClockTools().timer ?? undefined).toBeUndefined()
})

test('a payload whose timer is missing its instant is discarded, not half-loaded', () => {
  localStorage.setItem(
    'dienius:clock-tools',
    JSON.stringify({ timer: { durationMs: 60_000, elapsedBeforeMs: 0, paused: false } }),
  )
  expect(loadClockTools().timer ?? undefined).toBeUndefined()
})

// A timer started from a task's step carries the step - the date, the task
// and the step's id - so the tab that watches it run out can tick the step,
// and a reload in between does not lose which step that was.
test('a timer started for a step keeps the step across a reload', () => {
  clockTools.startTimer(10 * 60_000, { date: '2026-09-16', taskId: 't1', subtaskId: 's1' })
  expect(getClockTools().timer?.step).toEqual({ date: '2026-09-16', taskId: 't1', subtaskId: 's1' })
  expect(loadClockTools().timer?.step).toEqual({ date: '2026-09-16', taskId: 't1', subtaskId: 's1' })
})

test('a timer started with no step has none, and a stored step with a piece missing is dropped', () => {
  clockTools.startTimer(60_000)
  expect(getClockTools().timer?.step).toBeUndefined()
  localStorage.setItem(
    'dienius:clock-tools',
    JSON.stringify({ timer: { startedAt: Date.now(), durationMs: 60_000, elapsedBeforeMs: 0, paused: false, step: { date: '2026-09-16' } } }),
  )
  expect(loadClockTools().timer?.step).toBeUndefined()
})

// The stopwatch's pointer to what it is measuring, from v2.15. The same shape
// and the same rule as TimerStep: a pointer, never a copy.

test('a stopwatch remembers the task it was started on, across a reload', () => {
  clockTools.startStopwatch({ date: '2026-09-16', taskId: 't-1' })
  expect(loadClockTools().stopwatch?.of).toEqual({ date: '2026-09-16', taskId: 't-1' })
})

test('a stopwatch started on nothing has no pointer, and that is an answer', () => {
  clockTools.startStopwatch()
  expect(loadClockTools().stopwatch?.of).toBeUndefined()
  // Sometimes you are timing how long the pasta takes.
  expect(loadClockTools().stopwatch?.paused).toBe(false)
})

test('a half-written pointer is dropped rather than half-believed', () => {
  const stored = { stopwatch: { startedAt: 1, elapsedBeforeMs: 0, paused: false, of: { date: '2026-09-16' } } }
  localStorage.setItem('dienius:clock-tools', JSON.stringify(stored))
  const back = loadClockTools()
  // The stopwatch itself survives; only the pointer that cannot be followed
  // is left out, the same way readStep treats a half-written TimerStep.
  expect(back.stopwatch?.startedAt).toBe(1)
  expect(back.stopwatch?.of).toBeUndefined()
})
