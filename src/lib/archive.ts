import { useSyncExternalStore } from 'react'
import type { AppData, DayType, MealType, Task } from './types'
import { getData } from './store'
import { exportJson } from './storage'
import { addDays, todayKey } from './dates'
import { weekdayOf } from './repeats'
import { originFor } from './taskIdentity'
import { dayScore } from '../widgets/day-plan/score'
import { isDemoMode } from './demoMode'
import { isTourSandbox } from './tourMode'
import { describeFailure, GitHubError, getCloudBackupStatus, isCloudBackupOn, putRepoFile, readRepoFile, subscribeCloudBackup } from './cloudBackup'

/**
 * The archive on GitHub - the owner's shift brief of 2026-09-25, stage 3,
 * and docs/ARCHIVE-FORMAT.md.
 *
 * The backup keeps the plan as it is now, and a day's last copy
 * (`data/history`); the snapshots keep a week of this device. Neither keeps
 * what a day was, in a shape somebody - or the owner's journal - can read a
 * month later to see the progress. This does, in the same private repo and
 * through the same token as the backup, with nothing more to set up:
 *
 * - **`archive/days/YYYY/MM/YYYY-MM-DD.json`**: one lived day - its kind, its
 *   blocks, what was ticked and when, the meals with their recipe, kcal and
 *   protein, the notes, the routines, the score. Written once the day is
 *   over - on the first open of a new day, after a backup, or on Archive
 *   now - and written again only when the day changes afterwards, by hand.
 *   Nothing else ever touches it.
 * - **`archive/weekly/YYYY-MM-DD.json`**: once a week, under the week's
 *   Monday, the whole plan as Export backup writes it - a file Settings,
 *   Import takes back. Never written over.
 * - **Nothing is deleted**, ever: the files are small, and the history is the
 *   point.
 *
 * Which days are written is kept on this device (`dienius:archive`), as a
 * mark of each day as it was written, so a run reads the repo only for a day
 * that changed or was never written from here. A day changes when the day
 * does - a task ticked, moved, written or taken away, a note, its journal -
 * and not when a recipe it ate or a category it used is renamed or retold
 * afterwards: the record keeps what those were when it was written. Two devices meet in the
 * files themselves: a day's path is its date, so there is one file for it
 * whoever writes it; a device finding it there as it would write it writes
 * nothing, and one holding an older copy of the day - `changedAt`, the
 * newest stamp in it - leaves the newer file alone. A write names the
 * version it read, and a refusal is answered by reading again.
 *
 * A failure is said on the archive's line in Settings, Backup, and marks
 * nothing: whatever was not written waits for the next run, with no
 * connection as with none.
 */

export const ARCHIVE_KEY = 'dienius:archive'

/** Days written in one run at most, oldest first: a first archive of a long history goes over a few runs rather than in one wait. */
const DAYS_PER_RUN = 40

/** One task of a lived day, as the archive writes it - docs/ARCHIVE-FORMAT.md. */
export interface TaskRecord {
  title: string
  time?: string
  minutes?: number
  category?: string
  /** Where it came from: a template's block, a routine, a repeat, a night's hours, or a hand. */
  from: 'template' | 'routine' | 'repeat' | 'night' | 'hand'
  /** On a night's hours, the date of the night they came with. */
  night?: string
  done: boolean
  doneAt?: string
  missed?: true
  setAside?: true
  core?: true
  key?: true
  recipe?: { title: string; kcal?: number; protein?: number; carbs?: number; fat?: number }
  meal?: MealType
  library?: { list: string; item: string }
  note?: string
}

/** One lived day, as the archive writes it - docs/ARCHIVE-FORMAT.md. */
export interface DayRecord {
  format: 'dienius-day'
  version: 1
  date: string
  kind: { letter: string; name: string } | null
  template: string | null
  dayType: DayType
  lowDay?: true
  score?: { done: number; of: number; counts: 'everything' | 'core' | 'key' }
  tasks: TaskRecord[]
  journal?: string
  notes?: { at: string; text: string }[]
  /** The newest change to anything in the day: which of two copies of it is the later. */
  changedAt: string | null
}

interface ArchiveState {
  /** Date key to the mark of the day as written, or found written, for it - see `mark`. */
  written: Record<string, string>
  /** The Mondays whose week file is written, or was found there. */
  weeks: string[]
}

export type ArchivePhase = 'off' | 'idle' | 'working' | 'error' | 'offline'

export interface ArchiveStatus {
  phase: ArchivePhase
  /** A sentence somebody can act on, or null. */
  message: string | null
  /** The last lived day with every lived day before it archived, or null. */
  through: string | null
}

let state: ArchiveState = loadState()
let status: ArchiveStatus = { phase: 'off', message: null, through: null }
const listeners = new Set<() => void>()
let inFlight: Promise<boolean> | null = null
let started = false

function loadState(): ArchiveState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return { written: {}, weeks: [] }
    const p = parsed as Record<string, unknown>
    const written = typeof p.written === 'object' && p.written !== null ? (p.written as Record<string, unknown>) : {}
    return {
      written: Object.fromEntries(Object.entries(written).filter((e): e is [string, string] => typeof e[1] === 'string')),
      weeks: Array.isArray(p.weeks) ? p.weeks.filter((w): w is string => typeof w === 'string') : [],
    }
  } catch {
    // What does not read as the archive's record reads as nothing written,
    // and the next run reads the repo, which is where the truth is anyway.
    return { written: {}, weeks: [] }
  }
}

function saveState(): void {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(state))
  } catch {
    // Storage refusing means the next run reads the repo again. Nothing is lost.
  }
}

function setStatus(patch: Partial<ArchiveStatus>): void {
  status = { ...status, ...patch }
  listeners.forEach(fn => fn())
}

export function getArchiveStatus(): ArchiveStatus {
  return status
}

export function subscribeArchive(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useArchiveStatus(): ArchiveStatus {
  return useSyncExternalStore(subscribeArchive, getArchiveStatus, getArchiveStatus)
}

// --- the record ------------------------------------------------------------------

/** Where a lived day's file is: by its year and its month, so a year of them is twelve folders. */
export function dayPath(date: string): string {
  return `archive/days/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.json`
}

/** Where a week's whole backup is, named by its Monday. */
export function weekPath(monday: string): string {
  return `archive/weekly/${monday}.json`
}

/** The Monday of a date's week. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

function fromOf(task: Task): TaskRecord['from'] {
  if (task.nightOf) return 'night'
  if (task.routineId) return 'routine'
  const origin = originFor(task).type
  return origin === 'template' ? 'template' : origin === 'repeat' ? 'repeat' : 'hand'
}

function taskRecord(task: Task, data: AppData): TaskRecord {
  // Keys in one order, and only what the task says: the same day is the same text.
  const out = { title: task.title } as TaskRecord
  if (task.time) out.time = task.time
  if (task.minutes !== undefined) out.minutes = task.minutes
  const category = task.category ? data.categories.find(c => c.id === task.category)?.label : undefined
  if (category) out.category = category
  out.from = fromOf(task)
  if (task.nightOf) out.night = task.nightOf
  out.done = task.done
  if (task.done && task.doneAt) out.doneAt = task.doneAt
  if (task.missed) out.missed = true
  if (task.setAside) out.setAside = true
  if (task.core) out.core = true
  if (task.highlight) out.key = true
  const recipe = task.recipeId ? data.recipes.find(r => r.id === task.recipeId) : undefined
  if (recipe) {
    out.recipe = { title: recipe.title }
    for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) if (recipe[key] !== undefined) out.recipe[key] = recipe[key]
  } else if (task.mealType) out.meal = task.mealType
  if (task.libraryRef) {
    const list = data.library.find(l => l.id === task.libraryRef!.listId)
    const item = list?.items.find(i => i.id === task.libraryRef!.itemId)
    if (list && item) out.library = { list: list.name, item: item.title }
  }
  if (task.note) out.note = task.note
  return out
}

/**
 * A lived day as the archive writes it, or null where the day holds nothing
 * - no task, no journal and no note. Pure, and the same day is the same
 * record: its tasks in the order of the day, timed by their time and the
 * untimed after, and each field only where the task says it.
 */
export function dayRecord(data: AppData, date: string): DayRecord | null {
  const day = data.days[date]
  const notes = data.scratch.filter(n => n.date === date)
  const journal = day?.journal?.trim() ? day.journal : undefined
  if (!day?.tasks.length && !journal && notes.length === 0) return null
  const tasks = [...(day?.tasks ?? [])].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title))
  const template = day?.templateId ? data.templates.find(t => t.id === day.templateId) : undefined
  const dayType: DayType = day?.dayType ?? 'full'
  const score = dayScore(day?.tasks ?? [], dayType, day?.lowDay)
  const stamps = [day?.updatedAt, ...(day?.tasks ?? []).map(t => t.updatedAt), ...notes.map(n => n.updatedAt)].filter((s): s is string => !!s).sort()
  return {
    format: 'dienius-day',
    version: 1,
    date,
    kind: template?.dayKind && template.kind !== 'week' ? { letter: template.dayKind.letter, name: template.name } : null,
    template: template?.name ?? null,
    dayType,
    ...(day?.lowDay ? { lowDay: true as const } : {}),
    ...(score.planned ? { score: { done: score.done, of: score.total, counts: day?.lowDay ? ('key' as const) : dayType === 'full' ? ('everything' as const) : ('core' as const) } } : {}),
    tasks: tasks.map(t => taskRecord(t, data)),
    ...(journal ? { journal } : {}),
    ...(notes.length > 0 ? { notes: notes.map(n => ({ at: n.createdAt, text: n.text })) } : {}),
    changedAt: stamps.length > 0 ? stamps[stamps.length - 1] : null,
  }
}

/** The text a record is written as: two spaces of indent, and a line at the end. */
export function recordText(record: DayRecord): string {
  return JSON.stringify(record, null, 2) + '\n'
}

/**
 * What tells one state of a day from another: the newest stamp in it, which
 * every change to a task, a note or the day itself moves, and how many tasks
 * and notes it holds, which a task taken away changes without a stamp of the
 * day's own. A recipe or a category retold afterwards moves neither.
 */
function mark(record: Pick<DayRecord, 'changedAt' | 'tasks' | 'notes'>): string {
  return `${record.changedAt ?? ''}|${record.tasks?.length ?? 0}|${record.notes?.length ?? 0}`
}

/** The lived days with something in them, oldest first. */
function livedDays(data: AppData, today: string): string[] {
  const dates = new Set([...Object.keys(data.days), ...data.scratch.map(n => n.date)])
  return [...dates].filter(date => date < today && dayRecord(data, date) !== null).sort()
}

/** The lived days not written as they now are. */
function pendingDays(data: AppData, today: string): string[] {
  return livedDays(data, today).filter(date => state.written[date] !== mark(dayRecord(data, date)!))
}

/**
 * The last lived day with every lived day up to it archived as it now is -
 * the "Archived until" of Settings - or null when the first is not.
 */
export function archivedThrough(data: AppData, today: string): string | null {
  let through: string | null = null
  for (const date of livedDays(data, today)) {
    if (state.written[date] !== mark(dayRecord(data, date)!)) break
    through = date
  }
  return through
}

// --- the writing -----------------------------------------------------------------

/**
 * One day written, unless the file already holds this state of it - from
 * this device or another - or a later one.
 */
async function writeDay(data: AppData, date: string): Promise<void> {
  const record = dayRecord(data, date)!
  const text = recordText(record)
  const path = dayPath(date)
  for (let attempt = 0; ; attempt++) {
    const file = await readRepoFile(path)
    if (file.text !== null) {
      let there: Partial<DayRecord> | null = null
      try {
        there = JSON.parse(file.text) as Partial<DayRecord>
      } catch {
        there = null
      }
      // The same state of the day, however its recipes read now; or a later
      // copy another device wrote, which stands - this device's older one is
      // taken as written, since it is, in a newer form.
      const same = there !== null && mark(there as DayRecord) === mark(record)
      const later = there !== null && typeof there.changedAt === 'string' && (record.changedAt === null || there.changedAt > record.changedAt)
      if (same || later) {
        state.written[date] = mark(record)
        return
      }
    }
    try {
      await putRepoFile(path, text, `Dienius archive ${date}`, file.sha)
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 409 || err.status === 422) && attempt === 0) continue
      throw err
    }
    state.written[date] = mark(record)
    return
  }
}

/** The week's whole backup, under its Monday - written where there is none, and never over one. */
async function writeWeek(data: AppData, today: string): Promise<void> {
  const monday = mondayOf(today)
  if (state.weeks.includes(monday)) return
  const path = weekPath(monday)
  const file = await readRepoFile(path)
  if (file.sha === null) {
    try {
      await putRepoFile(path, exportJson(data), `Dienius week of ${monday}`, null)
    } catch (err) {
      // Written by another device between the read and the write: it stays.
      if (!(err instanceof GitHubError && (err.status === 409 || err.status === 422))) throw err
    }
  }
  state.weeks = [...state.weeks, monday]
}

/**
 * Writes what is not archived yet - the lived days, oldest first, up to
 * `DAYS_PER_RUN`, and this week's whole backup. One run at a time. Resolves
 * to whether the run finished; a failure is said on the line and marks
 * nothing it did not finish.
 */
export function archiveNow(): Promise<boolean> {
  if (!isCloudBackupOn() || isDemoMode() || isTourSandbox()) {
    setStatus({ phase: 'off', message: null })
    return Promise.resolve(false)
  }
  if (inFlight) return inFlight
  inFlight = run().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function run(): Promise<boolean> {
  const today = todayKey()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ phase: 'offline', message: 'No connection. What is not archived yet goes when there is one.', through: archivedThrough(getData(), today) })
    return false
  }
  setStatus({ phase: 'working', message: null })
  const data = getData()
  try {
    for (const date of pendingDays(data, today).slice(0, DAYS_PER_RUN)) {
      await writeDay(data, date)
      saveState()
    }
    await writeWeek(data, today)
    saveState()
    setStatus({ phase: 'idle', message: null, through: archivedThrough(getData(), today) })
    return true
  } catch (err) {
    saveState()
    setStatus({ phase: 'error', message: describeFailure(err), through: archivedThrough(getData(), today) })
    return false
  }
}

/**
 * Wires the archive's two occasions, once, from main.tsx: the first open of
 * a new day, and every backup after it - the moments a day is over and the
 * plan has just gone to the same repo anyway. Never on the sample data or
 * the tour's sandbox.
 */
export function startArchive(): void {
  if (started || isDemoMode() || isTourSandbox()) return
  started = true
  setStatus({ phase: isCloudBackupOn() ? 'idle' : 'off', through: archivedThrough(getData(), todayKey()) })
  let lastBackupAt = getCloudBackupStatus().lastBackupAt
  subscribeCloudBackup(() => {
    const now = getCloudBackupStatus()
    if (now.lastBackupAt && now.lastBackupAt !== lastBackupAt) {
      lastBackupAt = now.lastBackupAt
      void archiveNow()
    }
    if (!isCloudBackupOn() && status.phase !== 'off') setStatus({ phase: 'off', message: null })
  })
  if (isCloudBackupOn() && pendingDays(getData(), todayKey()).length > 0) void archiveNow()
}

export function resetArchiveForTests(): void {
  state = { written: {}, weeks: [] }
  status = { phase: 'off', message: null, through: null }
  inFlight = null
  started = false
  try {
    localStorage.removeItem(ARCHIVE_KEY)
  } catch {
    // Nothing to clear.
  }
}
