import { useSyncExternalStore } from 'react'
import type { AppData } from './types'
import { getData, onStateCommitted } from './store'
import { validate } from './validate'
import { importJson } from './storage'
import { isDemoMode } from './demoMode'
import { isTourSandbox } from './tourMode'
import { dateKey, todayKey } from './dates'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import { sawServerTime } from './clock'

/**
 * The third copy: a full snapshot of the plan in a private GitHub repo.
 *
 * The other two copies each cover one kind of loss. Sync (syncClient.ts)
 * keeps two devices agreeing, and the daily snapshots (snapshots.ts) keep a
 * week of this device's own history. Neither survives the phone in the
 * river and the laptop stolen in the same week, and neither is anywhere
 * the owner could open with a browser and read. This is that copy: off
 * site, in plain JSON, in a repo they own, written through GitHub's
 * Contents API with nothing in between. It works with sync off, on a
 * phone with no VPN, on any device that can reach github.com.
 *
 * Three rules, in order:
 *
 * 1. **The token stays on this device.** It lives under its own storage key,
 *    never in `AppData`, so it is in no export, no sync payload, no
 *    snapshot. A test holds each of those absences. A fine-grained token
 *    with Contents read and write on that one repo is the whole of what it
 *    needs, and the Settings copy says so.
 * 2. **It never blocks, and it never shouts.** Every push is fire-and-forget;
 *    a failure is a status line and a quiet retry, never a dialog. A backup
 *    that interrupts the day it is backing up gets turned off.
 * 3. **Restore never replaces anything without being told what it is
 *    replacing.** The cloud copy is read and described first - how many
 *    tasks, how recent - beside the same description of what is here, and
 *    the replacement is a second, armed press.
 *
 * Two files in the repo: `data/state.json`, the latest copy, and
 * `data/history/YYYY-MM-DD.json`, that day's last copy - a history for
 * free, one file a day, browsable on GitHub.
 *
 * **A copy is never older than the one it replaces.** Each write is the
 * merge of what the file holds and what this device holds, one entity at a
 * time, written over the version that was read (the Contents API's sha); a
 * refusal means another device wrote in between, and is answered by reading
 * and merging again. It was this device's whole plan, written over whatever
 * was there - so the phone, backing up on its first open of the morning,
 * put last night's copy over the desktop's evening one (docs/SYNC-AUDIT.md,
 * path 2). And a backup is never a sync: the merge goes to the file, never
 * into this device's plan. What the file held that this device had never
 * seen is only noted, as `othersUnseenAt`, for Settings to say.
 */

const CONFIG_KEY = 'dienius:cloud-backup'

/** Automatic pushes are spaced by at least this. A person pressing the button is not. */
export const BACKUP_MIN_INTERVAL_MS = 10 * 60_000

/** How long to wait before a silent retry after a failure. */
const RETRY_MS = 5 * 60_000

export const STATE_PATH = 'data/state.json'

export interface CloudBackupConfig {
  /** "owner/name". Empty means off. */
  repo: string
  token: string
  /** ISO instant of the last successful push, or null. */
  lastBackupAt: string | null
  /**
   * When the last backup found changes in the file this device had never
   * seen - another device backing up to the same repo - or null when it
   * found none. With sync off here, that is two plans that do not meet,
   * and Settings says so in red (docs/SYNC-AUDIT.md, path 3).
   */
  othersUnseenAt: string | null
}

export type CloudBackupPhase = 'off' | 'idle' | 'working' | 'error' | 'offline'

export interface CloudBackupStatus {
  phase: CloudBackupPhase
  lastBackupAt: string | null
  /** A sentence somebody can act on. Never a status code alone. */
  message: string | null
  /** See `CloudBackupConfig.othersUnseenAt`. */
  othersUnseenAt: string | null
}

/** Why a push was asked for - only the reason that matters for spacing. */
export type BackupReason = 'evening-close' | 'new-day' | 'manual'

/** What a copy holds, said the way a person compares two of them. */
/**
 * What one copy of the plan holds, part by part.
 *
 * Tasks and days were the whole of it until v2.17, and a restore replaces
 * *everything* - so a cloud copy carrying fourteen books and a North text over
 * an empty week read as "empty", and a restore about to wipe a library looked
 * exactly like one that would not. The file always had all of it; the screen
 * that asks somebody to confirm was the part that could not see it.
 *
 * Counts rather than contents, because this is a thing to glance at before
 * pressing a button that cannot be undone. What it is for is spotting a
 * number that is about to go down.
 */
export interface StateSummary {
  tasks: number
  days: number
  templates: number
  /** Items across every library list, which is what a person calls "books". */
  books: number
  /**
   * The lines of North's text that hold words. Goals had this row until they
   * were retired in v2.28; the text is what North is now, and a restore
   * about to replace it with a shorter one - or with none - is the one to
   * be told about.
   */
  north: number
  categories: number
  /** Later, still called `backlog` in the file - see LaterItem in types.ts. */
  later: number
  /** Kitchen's recipes. */
  recipes: number
  /** Rotating shifts' routines. */
  routines: number
  /** The latest date key with anything on it, or null on an empty plan. */
  newest: string | null
}

const EMPTY_CONFIG: CloudBackupConfig = { repo: '', token: '', lastBackupAt: null, othersUnseenAt: null }

let config: CloudBackupConfig = loadConfig()
let status: CloudBackupStatus = {
  phase: config.repo && config.token ? 'idle' : 'off',
  lastBackupAt: config.lastBackupAt,
  message: null,
  othersUnseenAt: config.othersUnseenAt,
}
const listeners = new Set<() => void>()
let dirty = false
let inFlight: Promise<boolean> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopCommitWatch: (() => void) | null = null
let started = false

function loadConfig(): CloudBackupConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...EMPTY_CONFIG }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_CONFIG }
    const p = parsed as Record<string, unknown>
    return {
      repo: typeof p.repo === 'string' ? p.repo : '',
      token: typeof p.token === 'string' ? p.token : '',
      lastBackupAt: typeof p.lastBackupAt === 'string' ? p.lastBackupAt : null,
      othersUnseenAt: typeof p.othersUnseenAt === 'string' ? p.othersUnseenAt : null,
    }
  } catch {
    return { ...EMPTY_CONFIG }
  }
}

function saveConfig(): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Storage refusing the write means the next open asks again. Nothing
    // else depends on it.
  }
}

function notify(): void {
  listeners.forEach(fn => fn())
}

function setStatus(patch: Partial<CloudBackupStatus>): void {
  status = { ...status, ...patch }
  notify()
}

export function getCloudBackupConfig(): CloudBackupConfig {
  return config
}

export function isCloudBackupOn(): boolean {
  return config.repo.trim() !== '' && config.token.trim() !== ''
}

/** Saves the repo and the token, on this device only. */
export function setCloudBackupConfig(next: { repo: string; token: string }): void {
  const repo = next.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '')
  config = { ...config, repo, token: next.token.trim() }
  saveConfig()
  setStatus({ phase: isCloudBackupOn() ? 'idle' : 'off', message: null })
}

export function getCloudBackupStatus(): CloudBackupStatus {
  return status
}

export function subscribeCloudBackup(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCloudBackupStatus(): CloudBackupStatus {
  return useSyncExternalStore(subscribeCloudBackup, getCloudBackupStatus, getCloudBackupStatus)
}

/**
 * Wires the two automatic occasions. Called once from main.tsx; a no-op
 * on a device with no repo, and never on the sample data or the tour's
 * sandbox, which are not plans worth a copy.
 */
export function startCloudBackup(): void {
  if (started) return
  started = true
  if (isDemoMode() || isTourSandbox()) return
  stopCommitWatch = onStateCommitted(() => {
    dirty = true
  })
  // The first open of a new day fixes yesterday: a copy whose date is
  // before today means the day that just ended has never been backed up in
  // its final state. The date is the device's own, like today's: the first
  // ten characters of the instant were its date in UTC, which put a copy
  // made just after midnight here on the day before.
  const lastDate = config.lastBackupAt ? dateKey(new Date(config.lastBackupAt)) : null
  if (isCloudBackupOn() && lastDate !== todayKey()) {
    dirty = true
    void requestCloudBackup('new-day')
  }
}

/**
 * Asks for a push. Automatic reasons are spaced by BACKUP_MIN_INTERVAL_MS
 * and skipped when nothing has changed since the last copy; a manual press
 * goes now, because a person pressing a button has decided. Resolves to
 * whether a copy was written.
 */
export function requestCloudBackup(reason: BackupReason, now = Date.now()): Promise<boolean> {
  if (!isCloudBackupOn() || isDemoMode() || isTourSandbox()) return Promise.resolve(false)
  if (reason !== 'manual') {
    if (!dirty) return Promise.resolve(false)
    const last = config.lastBackupAt ? new Date(config.lastBackupAt).getTime() : 0
    if (now - last < BACKUP_MIN_INTERVAL_MS) return Promise.resolve(false)
  }
  if (inFlight) return inFlight
  inFlight = push().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function push(): Promise<boolean> {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ phase: 'offline', message: 'No connection. It will try again when there is one.' })
    scheduleRetry()
    return false
  }
  setStatus({ phase: 'working', message: null })
  const today = todayKey()
  try {
    const latest = await writeMerged(STATE_PATH, `Dienius backup ${today}`, getData())
    // The day's file from the same merge, merged once more with whatever
    // that file already holds - two devices backing up on one day each
    // leave the day's copy at least as whole as the other's.
    await writeMerged(historyPath(today), `Dienius ${today}`, latest.data)
    dirty = false
    const at = new Date().toISOString()
    config = { ...config, lastBackupAt: at, othersUnseenAt: latest.unseen ? at : null }
    saveConfig()
    setStatus({ phase: 'idle', lastBackupAt: at, message: null, othersUnseenAt: config.othersUnseenAt })
    return true
  } catch (err) {
    setStatus({ phase: 'error', message: describeFailure(err) })
    scheduleRetry()
    return false
  }
}

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (dirty) void requestCloudBackup('manual')
  }, RETRY_MS)
}

export function historyPath(date: string): string {
  return `data/history/${date}.json`
}

// --- the Contents API ------------------------------------------------------------

/** A failure with the status GitHub answered, so the message can say what to check. */
export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function apiUrl(path: string): string {
  return `https://api.github.com/repos/${config.repo}/contents/${path}`
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** What a file in the repo holds, and the version it was read at. */
export interface RepoFile {
  /** `null` where the file does not exist yet. */
  sha: string | null
  text: string | null
}

/**
 * Reads one file with the version it is at.
 *
 * `no-store`, and it is the difference between a retry working and being
 * theatre. GitHub sends `Cache-Control: private, max-age=60` on a Contents
 * response, so a plain re-read inside that minute can be answered out of the
 * browser's own cache with the sha that was just refused - and a second
 * write carrying it is certain to be refused as well. Re-reading has to
 * actually read.
 *
 * Asked for as the "object" form, which answers for a file of any size up
 * to 100 MB: past one megabyte the ordinary form is refused outright, with a
 * 403 that read here as a token GitHub would not take, while the object form
 * still sends the sha and leaves the content out - which is then fetched
 * raw. A plan grows past a megabyte in a few months of blocks.
 */
export async function readRepoFile(path: string): Promise<RepoFile> {
  const res = await fetch(apiUrl(path), { headers: { ...headers(), Accept: 'application/vnd.github.object+json' }, cache: 'no-store' })
  if (res.status === 404) return { sha: null, text: null }
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} reading ${path}`)
  const body = (await res.json()) as { sha?: unknown; content?: unknown; encoding?: unknown; size?: unknown }
  const sha = typeof body.sha === 'string' ? body.sha : null
  if (typeof body.content === 'string' && body.content !== '' && body.encoding !== 'none') {
    return { sha, text: fromBase64(body.content) }
  }
  if (body.size === 0) return { sha, text: '' }
  return { sha, text: await readFile(path) }
}

/**
 * How a write may travel. `keepalive` asks the browser to carry the request
 * past the page where it is small enough to be allowed; `onlyIfCarried`
 * sends nothing where it is not - a request the page will not live to see
 * answered is only worth making if the browser takes it over.
 */
export interface PutOptions {
  keepalive?: boolean
  onlyIfCarried?: boolean
}

/**
 * Writes one file over the version that was read - `sha` null to create it
 * - and learns GitHub's clock from the commit it makes (see clock.ts).
 * Resolves to the file's new sha when GitHub says it, or null - and to null
 * without writing when `onlyIfCarried` could not be kept. Throws a
 * GitHubError on a refusal, 409 and 422 included: which of those to answer
 * by reading again is the caller's to decide.
 */
export async function putRepoFile(
  path: string,
  content: string,
  message: string,
  sha: string | null,
  options: PutOptions = {},
): Promise<string | null> {
  const body = JSON.stringify({ message, content: toBase64(content), ...(sha ? { sha } : {}) })
  const carried = options.keepalive === true && body.length < KEEPALIVE_MAX_CHARS
  if (options.onlyIfCarried && !carried) return null
  const sentAt = Date.now()
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body,
    ...(carried ? { keepalive: true } : {}),
  })
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} writing ${path}`)
  try {
    const answer = (await res.json()) as { content?: { sha?: unknown }; commit?: { committer?: { date?: unknown } } }
    const date = answer.commit?.committer?.date
    if (typeof date === 'string') sawServerTime(date, sentAt, Date.now())
    return typeof answer.content?.sha === 'string' ? answer.content.sha : null
  } catch {
    // An answer without a commit in it says nothing about the clock, nor
    // about the version now there.
    return null
  }
}

/** A request the browser may carry past the page is capped at 64 KB, body and all. */
const KEEPALIVE_MAX_CHARS = 60_000

/**
 * One file written as the merge of what it holds and `base`, over the
 * version that was read; a refusal - another device wrote in between - is
 * answered once by reading and merging again, and a second is reported.
 * Returns what was written, and whether the file held anything `base` had
 * not: a change from somewhere else.
 *
 * A file that is not a plan is written over: a backup that refused to run
 * because its own file had been broken by hand would be no backup at all.
 */
async function writeMerged(path: string, message: string, base: AppData): Promise<{ data: AppData; unseen: boolean }> {
  for (let attempt = 0; ; attempt++) {
    const file = await readRepoFile(path)
    const there = parsePlan(file.text)
    const merged = there ? mergeStates(base, normaliseRemote(there), new Date().toISOString()) : null
    const data = merged ? merged.data : base
    try {
      await putRepoFile(path, JSON.stringify(data, null, 2), message, file.sha)
      return { data, unseen: merged !== null && (merged.applied > 0 || merged.deleted > 0) }
    } catch (err) {
      if (err instanceof GitHubError && (err.status === 409 || err.status === 422) && attempt === 0) continue
      throw err
    }
  }
}

function parsePlan(text: string | null): AppData | null {
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return isSyncableState(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Reads one file's text, or null when it is not there. */
export async function readFile(path: string): Promise<string | null> {
  // Never from the cache - see shaOf. A restore reading a copy a minute out
  // of date would be this feature doing the one thing it must not.
  const res = await fetch(apiUrl(path), { headers: { ...headers(), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} reading ${path}`)
  return res.text()
}

/** UTF-8 to base64, the way the Contents API wants it. btoa alone chokes on anything past Latin-1. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function fromBase64(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * What to say when GitHub says no. Each names the thing to check, because
 * "Error 401" tells a person something is wrong and nothing about what to
 * do.
 */
export function describeFailure(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.status === 401 || err.status === 403) {
      return 'GitHub refused the token. It needs Contents read and write on that one repo, and it may have expired.'
    }
    if (err.status === 404) return 'That repo was not found. Check the name, and that the token can see it.'
    // It used to say "another device wrote the backup at the same moment",
    // which is a cause this code cannot know and which the owner read as
    // nonsense, having only one device. What is actually true is what the
    // API said: the file moved between the read and the write, twice over,
    // because the write is tried again with a fresh sha before it gives up.
    // The second sentence is the useful one for somebody with one device:
    // two tabs, the GitHub web editor, or anything else writing that repo.
    if (err.status === 409 || err.status === 422) {
      return 'The file on GitHub changed between reading it and writing it, twice over. It will try again, and if it keeps saying this then something else is writing to that repo.'
    }
    return `GitHub answered ${err.status}. It will try again.`
  }
  return 'Cannot reach GitHub. It will try again when there is a connection.'
}

// --- restore -------------------------------------------------------------------

export interface RestorePreview {
  data: AppData
  cloud: StateSummary
  here: StateSummary
}

/** Counts a copy the way a person compares two: how much, and how recent. */
export function summarise(data: AppData): StateSummary {
  const days = Object.values(data.days).filter(d => d.tasks.length > 0 || d.templateId)
  const tasks = days.reduce((n, d) => n + d.tasks.length, 0)
  const dates = days.map(d => d.date).sort()
  return {
    tasks,
    days: days.length,
    templates: data.templates.length,
    books: data.library.reduce((n, l) => n + l.items.length, 0),
    north: (data.picture?.text ?? '').split('\n').filter(line => line.trim() !== '').length,
    categories: data.categories.length,
    later: data.backlog.length,
    recipes: data.recipes.length,
    routines: data.routines.length,
    newest: dates.at(-1) ?? null,
  }
}

/**
 * The two copies side by side, one row per part, and which rows would lose
 * something.
 *
 * Only "fewer" is marked. A restore that brings more of something needs no
 * warning; a restore that brings less is the one nobody meant to press.
 * Categories are counted but never marked, because every plan ships with the
 * six defaults and a copy with fewer of them is a copy somebody deliberately
 * tidied - not a loss anybody needs stopping for.
 */
export interface SummaryRow {
  label: string
  here: number
  cloud: number
  /** True when restoring would replace a larger number with a smaller one. */
  loses: boolean
}

export function compareSummaries(here: StateSummary, cloud: StateSummary): SummaryRow[] {
  const row = (label: string, key: keyof StateSummary, warn = true): SummaryRow => {
    const a = here[key] as number
    const b = cloud[key] as number
    return { label, here: a, cloud: b, loses: warn && b < a }
  }
  return [
    row('Days', 'days'),
    row('Tasks', 'tasks'),
    row('Templates', 'templates'),
    row('Library books', 'books'),
    row('North lines', 'north'),
    row('Categories', 'categories', false),
    row('Later', 'later'),
    row('Recipes', 'recipes'),
    row('Routines', 'routines'),
  ]
}

/** "340 tasks across 41 days, newest 4 Sep" - or "empty". */
export function describeSummary(s: StateSummary): string {
  if (s.tasks === 0 && s.days === 0) return 'empty'
  const when = s.newest ? `, newest ${formatDateKey(s.newest)}` : ''
  return `${s.tasks} ${s.tasks === 1 ? 'task' : 'tasks'} across ${s.days} ${s.days === 1 ? 'day' : 'days'}${when}`
}

function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Reads the cloud copy and describes it beside what is here. Throws with a
 * readable message when there is nothing there or it is not a plan;
 * replaces nothing.
 */
export async function previewRestore(): Promise<RestorePreview> {
  const text = await readFile(STATE_PATH)
  if (text === null) throw new Error('There is no backup in that repo yet.')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The file in the repo is not a Dienius backup.')
  }
  if (!validate(parsed)) throw new Error('The file in the repo is not a Dienius backup.')
  // Through the same door a file import takes, so every migration applies.
  const data = importJson(text)
  return { data, cloud: summarise(data), here: summarise(getData()) }
}

/** "today 21:40", "yesterday 08:12", "Tue 2 Sep 21:40", "never". */
export function formatBackupTime(at: string | null, now = new Date()): string {
  if (!at) return 'never'
  const then = new Date(at)
  const time = then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayKey = localKey(then)
  const todayK = localKey(now)
  const yesterday = localKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  if (dayKey === todayK) return `today ${time}`
  if (dayKey === yesterday) return `yesterday ${time}`
  return `${then.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Test seam: forgets the config, the status and every timer. */
export function resetCloudBackupForTests(): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  inFlight = null
  dirty = false
  stopCommitWatch?.()
  stopCommitWatch = null
  started = false
  // Read again from the device, the way the module reads it when it loads, so
  // a test can say what the last copy was.
  config = loadConfig()
  status = { phase: 'off', lastBackupAt: null, message: null, othersUnseenAt: config.othersUnseenAt }
  listeners.clear()
}

/** Test seam: marks the plan as changed since the last copy. */
export function markDirtyForTests(): void {
  dirty = true
}
