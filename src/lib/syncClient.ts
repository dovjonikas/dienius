import { useSyncExternalStore } from 'react'
import { getData, onStateCommitted, replaceState } from './store'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'

/**
 * The sync client: pull on open, push shortly after every change, and never
 * get in the way.
 *
 * Three rules it holds to, in order of importance:
 *
 * 1. **It never blocks the UI.** Every call is fire-and-forget. A server that
 *    is asleep, unreachable, or on the other side of a VPN that is not up
 *    costs nothing but a status line.
 * 2. **It never deletes anything because the server disagreed.** A response
 *    that does not look like a state is ignored entirely and reported. The
 *    worst outcome of a broken server has to be "no sync", never "no data".
 * 3. **It is off unless somebody turned it on.** Local-first is the product;
 *    this is a layer on top.
 *
 * Config lives under its own storage key rather than in the state, because
 * syncing the address of the sync server is circular and a token is a
 * device's own credential.
 */

const CONFIG_KEY = 'dienius:sync'

/** How long after a change to push. Long enough to coalesce a burst of edits. */
export const PUSH_DEBOUNCE_MS = 2500

/** How long to wait before retrying after a failure, and the ceiling. */
const RETRY_BASE_MS = 5000
const RETRY_MAX_MS = 60_000

export interface SyncConfig {
  url: string
  token: string
  enabled: boolean
}

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
  phase: SyncPhase
  /** ISO instant of the last completed sync, or null. */
  lastSyncedAt: string | null
  /** Something a person can read. Never a stack trace, never a status code alone. */
  message: string | null
  /** True while a push is owed - the reason "Saved" is not shown yet. */
  pending: boolean
}

const EMPTY_CONFIG: SyncConfig = { url: '', token: '', enabled: false }

let config: SyncConfig = loadConfig()
let status: SyncStatus = {
  phase: config.enabled ? 'idle' : 'off',
  lastSyncedAt: null,
  message: null,
  pending: false,
}

const listeners = new Set<() => void>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = RETRY_BASE_MS
/** The round trip currently running, so a second caller joins it rather than racing it. */
let inFlight: Promise<void> | null = null
/** Set when something changed while a round trip was already in the air. */
let changedDuringSync = false
let started = false
let stopCommitWatch: (() => void) | null = null

function notify(): void {
  listeners.forEach(fn => fn())
}

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  notify()
}

// --- configuration -------------------------------------------------------

function loadConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...EMPTY_CONFIG }
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    return {
      url: typeof parsed.url === 'string' ? parsed.url : '',
      token: typeof parsed.token === 'string' ? parsed.token : '',
      enabled: parsed.enabled === true,
    }
  } catch {
    return { ...EMPTY_CONFIG }
  }
}

export function getSyncConfig(): SyncConfig {
  return config
}

export function setSyncConfig(next: SyncConfig): void {
  config = { ...next, url: next.url.trim().replace(/\/+$/, '') }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // A device that cannot store its own sync config simply does not sync.
  }
  setStatus({ phase: config.enabled ? 'idle' : 'off', message: null })
  if (config.enabled) void syncNow()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus)
}

// --- the loop ------------------------------------------------------------

/**
 * Arms everything: one pull on open, a debounced push after each commit, and
 * a retry when the network comes back. Safe to call more than once.
 */
export function startSync(): void {
  if (started) return
  started = true

  stopCommitWatch = onStateCommitted(() => {
    if (!config.enabled) return
    setStatus({ pending: true })
    schedulePush()
  })

  if (typeof window !== 'undefined') {
    // Coming back online, and coming back to the tab, are both good moments to
    // find out what the other device did while this one was away.
    window.addEventListener('online', () => void syncNow())
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void syncNow()
    })
  }

  if (config.enabled) void syncNow()
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void syncNow()
  }, PUSH_DEBOUNCE_MS)
}

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    void syncNow()
  }, retryDelay)
  // Backing off rather than hammering: a server that is off is going to stay
  // off for a while, and a retry every five seconds all afternoon is a phone
  // battery spent on nothing.
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
}

/**
 * One full round trip: read what the server has, merge it in, write back the
 * result.
 *
 * Push and pull are the same operation on purpose. Sending only local changes
 * would need a record of what the server has already seen, which is a second
 * kind of state to get wrong; the whole state is a few hundred kilobytes and
 * this runs on a home network.
 */
export function syncNow(): Promise<void> {
  if (!config.enabled || !config.url) return Promise.resolve()
  // A second caller joins the round trip already in the air rather than
  // opening a competing one - two syncs overlapping would each merge against
  // a state the other is about to replace.
  if (inFlight) {
    changedDuringSync = true
    return inFlight
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ phase: 'offline', message: 'No connection. It will catch up.' })
    return Promise.resolve()
  }

  changedDuringSync = false
  setStatus({ phase: 'syncing', message: null })
  inFlight = runSync().finally(() => {
    inFlight = null
    // Whatever changed mid-flight was not in the state that just went up.
    if (changedDuringSync && status.phase !== 'error') schedulePush()
  })
  return inFlight
}

async function runSync(): Promise<void> {
  try {
    const remote = await request('GET')
    if (remote !== null && !isSyncableState(remote)) {
      // Conservative by design: something is on the other end and it is not a
      // Dienius state. Nothing local is touched.
      fail('The server answered with something that is not a plan. Nothing was changed here.')
      return
    }

    const local = getData()
    const merged =
      remote === null ? { data: local, applied: 0, deleted: 0 } : mergeStates(local, normaliseRemote(remote), new Date().toISOString())

    if (merged.applied > 0 || merged.deleted > 0) replaceState(merged.data)

    await request('POST', merged.data)

    retryDelay = RETRY_BASE_MS
    setStatus({ phase: 'idle', lastSyncedAt: new Date().toISOString(), message: null, pending: false })
  } catch (error) {
    fail(describe(error))
  }
}

function fail(message: string): void {
  setStatus({ phase: 'error', message })
  scheduleRetry()
}

async function request(method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
  const response = await fetch(`${config.url}/state`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401) throw new SyncError('That token was refused. Check it against the server.')
  if (!response.ok) throw new SyncError(`The server answered ${response.status}.`)
  return method === 'GET' ? ((await response.json()) as unknown) : null
}

class SyncError extends Error {}

/**
 * Turns whatever went wrong into a sentence.
 *
 * A person looking at a sync status wants to know whether to do something, and
 * "TypeError: Failed to fetch" does not answer that. The common case by a wide
 * margin is that the PC is asleep or Tailscale is not up, so that is what the
 * generic message says.
 */
function describe(error: unknown): string {
  if (error instanceof SyncError) return error.message
  return 'Cannot reach the server. Is the PC awake, and Tailscale connected?'
}

/** Test seam: forgets config, status, and every pending timer. */
export function resetSyncForTests(): void {
  if (pushTimer) clearTimeout(pushTimer)
  if (retryTimer) clearTimeout(retryTimer)
  pushTimer = null
  retryTimer = null
  retryDelay = RETRY_BASE_MS
  inFlight = null
  changedDuringSync = false
  stopCommitWatch?.()
  stopCommitWatch = null
  started = false
  config = { ...EMPTY_CONFIG }
  status = { phase: 'off', lastSyncedAt: null, message: null, pending: false }
  listeners.clear()
}

/** "4 minutes ago", for the one line Settings shows. */
export function formatSyncedAt(at: string | null, now = Date.now()): string {
  if (!at) return 'not yet'
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
