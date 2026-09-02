import { useSyncExternalStore } from 'react'

/**
 * The timer and the stopwatch, and the small amount of state they need to
 * survive a refresh.
 *
 * **Its own storage key, not part of AppData.** Everything in `dienius:data`
 * is a plan - something a person wrote down and would want back from a
 * backup. A timer with ninety seconds left on it is neither: exporting it
 * into a backup file would be strange, and importing one from last Tuesday
 * would be worse. It is written under its own key, and the two places that
 * erase everything (Settings, and the crash screen) clear it alongside the
 * main key so "erase all data" still means all of it.
 *
 * **Stored as an instant plus a length, never as a countdown.** A running
 * timer keeps only when it started and how long it is; the number on screen
 * is derived on every tick. That is what makes it survive a refresh, a
 * background tab that stops getting frames, a phone that sleeps, and a
 * service worker reload mid-session - all of which would quietly desynchronise
 * a stored "seconds remaining" that something has to keep decrementing. It is
 * also why an app opened after the timer already ran out can say how long ago
 * that was, instead of finding a stale zero.
 *
 * **One of each, deliberately.** Multiple concurrent timers is a feature
 * request with a real cost - every surface that shows one has to become a
 * list, and the floating widget stops being glanceable - and there is no
 * version of a day plan where two countdowns at once is the simple answer.
 */

const STORAGE_KEY = 'dienius:clock-tools'

export interface TimerState {
  /** Epoch milliseconds when the current run began, or resumed after a pause. */
  startedAt: number
  /** How long the timer was set for, in milliseconds. Never changes for a given run. */
  durationMs: number
  /**
   * Milliseconds already elapsed before the current run. Zero for a timer
   * that has never been paused; the accumulated total for one that has.
   */
  elapsedBeforeMs: number
  /** True while paused - `startedAt` is then meaningless until it resumes. */
  paused: boolean
  /**
   * True once it has run out and before anybody has acknowledged it. What
   * keeps the widget pulsing after the fact rather than silently resetting,
   * and what a fresh page load reads to know it should say "finished 8 min
   * ago" instead of nothing at all.
   */
  rungOut?: boolean
}

export interface StopwatchState {
  startedAt: number
  elapsedBeforeMs: number
  paused: boolean
}

export interface ClockTools {
  timer: TimerState | null
  stopwatch: StopwatchState | null
  /** Which corner the floating widget sits in. A preference, so it persists. */
  corner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}

const EMPTY: ClockTools = { timer: null, stopwatch: null, corner: 'bottom-right' }

function isCorner(x: unknown): x is ClockTools['corner'] {
  return x === 'bottom-right' || x === 'bottom-left' || x === 'top-right' || x === 'top-left'
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

function readTimer(x: unknown): TimerState | null {
  if (typeof x !== 'object' || x === null) return null
  const t = x as Record<string, unknown>
  if (!isFiniteNumber(t.startedAt) || !isFiniteNumber(t.durationMs) || !isFiniteNumber(t.elapsedBeforeMs)) return null
  if (typeof t.paused !== 'boolean') return null
  if (t.durationMs <= 0 || t.elapsedBeforeMs < 0) return null
  return {
    startedAt: t.startedAt,
    durationMs: t.durationMs,
    elapsedBeforeMs: t.elapsedBeforeMs,
    paused: t.paused,
    rungOut: t.rungOut === true,
  }
}

function readStopwatch(x: unknown): StopwatchState | null {
  if (typeof x !== 'object' || x === null) return null
  const s = x as Record<string, unknown>
  if (!isFiniteNumber(s.startedAt) || !isFiniteNumber(s.elapsedBeforeMs)) return null
  if (typeof s.paused !== 'boolean' || s.elapsedBeforeMs < 0) return null
  return { startedAt: s.startedAt, elapsedBeforeMs: s.elapsedBeforeMs, paused: s.paused }
}

function load(): ClockTools {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY
    const p = parsed as Record<string, unknown>
    return {
      timer: readTimer(p.timer),
      stopwatch: readStopwatch(p.stopwatch),
      corner: isCorner(p.corner) ? p.corner : 'bottom-right',
    }
  } catch {
    // Storage can be unavailable or hold something else entirely. A timer is
    // not worth failing a page load over - see the same reasoning in
    // storage.ts and the pre-paint script.
    return EMPTY
  }
}

let state: ClockTools = load()
const listeners = new Set<() => void>()

function commit(next: ClockTools): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Same rule the main store follows: a failed write must not lose the
    // in-memory change or throw into a click handler.
  }
  listeners.forEach(fn => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getClockTools(): ClockTools {
  return state
}

export function useClockTools(): ClockTools {
  return useSyncExternalStore(subscribe, getClockTools, getClockTools)
}

/** Wipes both tools - called by the two paths that erase everything. */
export function clearClockTools(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to recover from: the in-memory reset below is what matters.
  }
  state = EMPTY
  listeners.forEach(fn => fn())
}

export const clockTools = {
  startTimer(durationMs: number): void {
    if (durationMs <= 0) return
    commit({ ...state, timer: { startedAt: Date.now(), durationMs, elapsedBeforeMs: 0, paused: false } })
  },

  pauseTimer(): void {
    const t = state.timer
    if (!t || t.paused) return
    commit({
      ...state,
      timer: { ...t, paused: true, elapsedBeforeMs: t.elapsedBeforeMs + (Date.now() - t.startedAt) },
    })
  },

  resumeTimer(): void {
    const t = state.timer
    if (!t || !t.paused) return
    commit({ ...state, timer: { ...t, paused: false, startedAt: Date.now() } })
  },

  /** Marks a timer that has run out as seen - what stops the widget pulsing. */
  acknowledgeTimer(): void {
    commit({ ...state, timer: null })
  },

  cancelTimer(): void {
    commit({ ...state, timer: null })
  },

  /**
   * Records that this run has rung out, so a reload knows the difference
   * between a timer still counting and one waiting to be acknowledged.
   * Idempotent - the tick that notices calls it, and every tick after is a
   * no-op rather than a fresh alarm.
   */
  markRungOut(): void {
    const t = state.timer
    if (!t || t.rungOut) return
    commit({ ...state, timer: { ...t, rungOut: true } })
  },

  startStopwatch(): void {
    commit({ ...state, stopwatch: { startedAt: Date.now(), elapsedBeforeMs: 0, paused: false } })
  },

  pauseStopwatch(): void {
    const s = state.stopwatch
    if (!s || s.paused) return
    commit({
      ...state,
      stopwatch: { ...s, paused: true, elapsedBeforeMs: s.elapsedBeforeMs + (Date.now() - s.startedAt) },
    })
  },

  resumeStopwatch(): void {
    const s = state.stopwatch
    if (!s || !s.paused) return
    commit({ ...state, stopwatch: { ...s, paused: false, startedAt: Date.now() } })
  },

  resetStopwatch(): void {
    commit({ ...state, stopwatch: null })
  },

  setCorner(corner: ClockTools['corner']): void {
    commit({ ...state, corner })
  },

  /** Test-only, mirroring `actions.resetForTests` in the main store. */
  resetForTests(next: ClockTools = EMPTY): void {
    commit(next)
  },
}

/** Milliseconds elapsed on a timer or stopwatch at `now`, pause included. */
export function elapsedMs(run: { startedAt: number; elapsedBeforeMs: number; paused: boolean }, now: number): number {
  return run.paused ? run.elapsedBeforeMs : run.elapsedBeforeMs + Math.max(0, now - run.startedAt)
}

/** Milliseconds left on a timer at `now`. Negative once it has run over. */
export function remainingMs(timer: TimerState, now: number): number {
  return timer.durationMs - elapsedMs(timer, now)
}

/**
 * "12:04", or "1:02:04" once there is an hour on the clock. Used by both
 * tools, so a running timer and a running stopwatch read identically and
 * nobody has to work out which one they are looking at from its format.
 */
export function formatClockMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** "8 min ago", "just now" - how long since a timer that nobody was there for ran out. */
export function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h ago` : `${hours}h ${rest}m ago`
}
