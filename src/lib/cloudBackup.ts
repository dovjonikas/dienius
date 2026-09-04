import { useSyncExternalStore } from 'react'
import type { AppData } from './types'
import { getData, onStateCommitted } from './store'
import { validate } from './validate'
import { importJson } from './storage'
import { isDemoMode } from './demoMode'
import { isTourSandbox } from './tourMode'
import { todayKey } from './dates'

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
 * free, one file a day, browsable on GitHub. Every write goes through the
 * Contents API's own optimistic lock: the file's current `sha` is sent with
 * the update, and a mismatch (another device wrote in between) is answered
 * by reading the new sha and writing once more.
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
}

export type CloudBackupPhase = 'off' | 'idle' | 'working' | 'error' | 'offline'

export interface CloudBackupStatus {
  phase: CloudBackupPhase
  lastBackupAt: string | null
  /** A sentence somebody can act on. Never a status code alone. */
  message: string | null
}

/** Why a push was asked for - only the reason that matters for spacing. */
export type BackupReason = 'evening-close' | 'new-day' | 'manual'

/** What a copy holds, said the way a person compares two of them. */
export interface StateSummary {
  tasks: number
  days: number
  /** The latest date key with anything on it, or null on an empty plan. */
  newest: string | null
}

const EMPTY_CONFIG: CloudBackupConfig = { repo: '', token: '', lastBackupAt: null }

let config: CloudBackupConfig = loadConfig()
let status: CloudBackupStatus = {
  phase: config.repo && config.token ? 'idle' : 'off',
  lastBackupAt: config.lastBackupAt,
  message: null,
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
  // its final state.
  const lastDate = config.lastBackupAt ? config.lastBackupAt.slice(0, 10) : null
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
  const data = getData()
  const json = JSON.stringify(data, null, 2)
  const today = todayKey()
  try {
    await writeFile(STATE_PATH, json, `Dienius backup ${today}`)
    await writeFile(historyPath(today), json, `Dienius ${today}`)
    dirty = false
    config = { ...config, lastBackupAt: new Date().toISOString() }
    saveConfig()
    setStatus({ phase: 'idle', lastBackupAt: config.lastBackupAt, message: null })
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

/** The file's current sha, or null when it does not exist yet. */
async function shaOf(path: string): Promise<string | null> {
  const res = await fetch(apiUrl(path), { headers: headers() })
  if (res.status === 404) return null
  if (!res.ok) throw new GitHubError(res.status, `GitHub answered ${res.status} reading ${path}`)
  const body = (await res.json()) as { sha?: unknown }
  return typeof body.sha === 'string' ? body.sha : null
}

/**
 * Writes one file, creating or updating it. The current sha is read first
 * and sent with the update - the Contents API's own optimistic lock. A 409
 * or 422 means the file moved under us (another device wrote it since the
 * read), and the honest answer is to read the new sha and write once more;
 * a second conflict is reported, not hidden.
 */
export async function writeFile(path: string, content: string, message: string): Promise<void> {
  let sha = await shaOf(path)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(apiUrl(path), {
      method: 'PUT',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: toBase64(content), ...(sha ? { sha } : {}) }),
    })
    if (res.ok) return
    if ((res.status === 409 || res.status === 422) && attempt === 0) {
      sha = await shaOf(path)
      continue
    }
    throw new GitHubError(res.status, `GitHub answered ${res.status} writing ${path}`)
  }
}

/** Reads one file's text, or null when it is not there. */
export async function readFile(path: string): Promise<string | null> {
  const res = await fetch(apiUrl(path), { headers: { ...headers(), Accept: 'application/vnd.github.raw+json' } })
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
    if (err.status === 409 || err.status === 422) return 'Another device wrote the backup at the same moment. It will try again.'
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
  return { tasks, days: days.length, newest: dates.at(-1) ?? null }
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
  config = { ...EMPTY_CONFIG }
  status = { phase: 'off', lastBackupAt: null, message: null }
  listeners.clear()
}

/** Test seam: marks the plan as changed since the last copy. */
export function markDirtyForTests(): void {
  dirty = true
}
