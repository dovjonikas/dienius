import { useSyncExternalStore } from 'react'
import { getData, onStateCommitted, replaceState } from './store'
import { isDemoMode } from './demoMode'
import { isTourSandbox } from './tourMode'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import { canSyncThroughGitHub, readSyncState, SyncConflictError, writeSyncState } from './githubSync'
import { GitHubError } from './cloudBackup'
import { dropDeletedFolds, foldInbox } from './later'

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

/**
 * The same, through GitHub, where every push is a commit.
 *
 * A server can be written to as often as there is something to say. A repo
 * keeps what it is told forever and shows it to a person as a list, so a
 * commit every two and a half seconds would turn a morning's planning into
 * four hundred lines of history nobody wants to read. Half a minute coalesces
 * an ordinary stretch of editing into one, and the push below on leaving the
 * device means the wait is never felt where it matters.
 */
export const GITHUB_PUSH_DEBOUNCE_MS = 30_000

/** Whichever of the two this device is on. */
function pushDelay(): number {
  return syncVia() === 'github' ? GITHUB_PUSH_DEBOUNCE_MS : PUSH_DEBOUNCE_MS
}

/** How long to wait before retrying after a failure, and the ceiling. */
const RETRY_BASE_MS = 5000
const RETRY_MAX_MS = 60_000

export interface SyncConfig {
  url: string
  token: string
  enabled: boolean
  /**
   * Where the two devices meet.
   *
   * `server` is a box of the owner's own, reached over Tailscale - the
   * original and still the quickest. `github` is the private repo the backup
   * already writes to, which is nothing to own, keep awake or reach, and
   * needs only the token that repo already has on this device. See
   * githubSync.ts.
   *
   * Absent on every device set up before this existed, where it means
   * `server`, which is what those devices are already doing.
   */
  via?: 'server' | 'github'
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

const EMPTY_CONFIG: SyncConfig = { url: '', token: '', enabled: false, via: 'server' }

/** Where this device is meeting the other one. */
export function syncVia(): 'server' | 'github' {
  return config.via ?? 'server'
}

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
      // Coming back is the moment to find out what the other device did.
      if (!document.hidden) {
        void syncNow()
        return
      }
      // And going away is the moment to say what this one did, which is the
      // whole of "it knows when you move to the phone": the computer pushes
      // as it is put down, so the phone's own pull on opening already has it.
      // Nothing is owed if nothing changed - syncNow returns at once.
      if (status.pending || pushTimer) void syncNow()
    })
    // The reliable one on a phone, where a tab is often discarded rather than
    // hidden. Both fire on some browsers and neither costs anything twice:
    // a second caller joins the round trip already in the air.
    window.addEventListener('pagehide', () => {
      if (status.pending || pushTimer) void syncNow()
    })
  }

  if (config.enabled) void syncNow()
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void syncNow()
  }, pushDelay())
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
/**
 * The one misconfiguration worth naming before it is attempted.
 *
 * A page served over HTTPS cannot call an `http://` endpoint: the browser
 * blocks it before anything leaves, and the failure arrives as the same
 * generic network error a sleeping PC gives. Guessing "is the PC awake" at
 * somebody whose PC is awake, over an address that can never work, is the
 * kind of wrong answer that costs an evening. Tailscale hands out a real
 * certificate for exactly this - see the README.
 */
function blockedByMixedContent(url: string): boolean {
  if (typeof location === 'undefined' || location.protocol !== 'https:') return false
  return url.startsWith('http://') && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)
}

export function syncNow(): Promise<void> {
  // "Nothing to reach" is a different question for each route: a server needs
  // an address typed in, and the repo needs the one Backup already holds.
  // This read "no address, nothing to do" for both, so turning sync on
  // through the repo did exactly nothing and said it was idle.
  if (!config.enabled) return Promise.resolve()
  if (syncVia() === 'server' && !config.url) return Promise.resolve()
  // The sample week is not anybody's plan and must never reach a server where
  // a real device would merge it in. Demo mode is a separate storage key, so
  // this is belt as well as braces - but the braces are worth having.
  if (isDemoMode()) return Promise.resolve()
  // The tour's sandbox, for the same reason: a starter template stamped onto
  // today by somebody replaying the tour must never reach their real devices.
  if (isTourSandbox()) return Promise.resolve()
  // Only the server route can be misconfigured this way; GitHub is https.
  if (syncVia() === 'server' && blockedByMixedContent(config.url)) {
    setStatus({
      phase: 'error',
      message: 'This page is on https, so the server address has to be too. Run "tailscale serve --bg 8787" and use the https address it prints.',
      pending: false,
    })
    return Promise.resolve()
  }
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

/**
 * How many times a round trip will start over because the other device wrote
 * while this one was merging.
 *
 * Two, and then it waits for the next one. A conflict is not an error - it is
 * both devices being used - and the cost of giving up for a few seconds is
 * nothing, while a loop that will not give up is a device writing to somebody
 * else's repo as fast as it can.
 */
const CONFLICT_RETRIES = 2

async function runSync(attempt = 0): Promise<void> {
  try {
    const remote = await request('GET')
    if (remote !== null && !isSyncableState(remote)) {
      // Conservative by design: something is on the other end and it is not a
      // Dienius state. Nothing local is touched.
      fail('The server answered with something that is not a plan. Nothing was changed here.')
      return
    }

    const local = getData()
    const now = new Date().toISOString()
    const merged =
      remote === null ? { data: local, applied: 0, deleted: 0 } : mergeStates(local, normaliseRemote(remote), now)

    // A merge result never passes through loadData, so the fold that turns
    // an older device's inbox into Later has to run here as well - before
    // the result is committed and before it goes back to the server, or the
    // server would hold a line under a name this device no longer reads.
    // See later.ts.
    const folded = dropDeletedFolds(
      foldInbox(merged.data, now),
      remote === null ? undefined : normaliseRemote(remote).tombstones,
      now,
    )
    if (merged.applied > 0 || merged.deleted > 0 || folded !== merged.data) replaceState(folded)

    try {
      await request('POST', folded)
    } catch (error) {
      // The shared copy moved between the read and the write, so what is in
      // hand was merged against a plan that is no longer the latest. Pull and
      // merge again rather than writing over what the other device just did -
      // see githubSync.ts, which is the only transport that can tell.
      if (error instanceof SyncConflictError && attempt < CONFLICT_RETRIES) {
        remoteSha = null
        return await runSync(attempt + 1)
      }
      throw error
    }

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

/**
 * The version the last GET came back at, held between the read and the write
 * of one round trip. Only the GitHub transport has one; a plain server has no
 * way to say "only if it is still the one you read".
 */
let remoteSha: string | null = null

async function request(method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
  if (syncVia() === 'github') {
    if (!canSyncThroughGitHub()) {
      throw new SyncError('Sync is set to use the GitHub repo, and there is no repo or token in Backup yet.')
    }
    if (method === 'GET') {
      const read = await readSyncState()
      remoteSha = read.sha
      return read.state
    }
    await writeSyncState(body, remoteSha)
    return null
  }
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
  if (error instanceof GitHubError) {
    if (error.status === 401 || error.status === 403) {
      return 'GitHub refused the token. It needs Contents read and write on that one repo, and it may have expired.'
    }
    if (error.status === 404) return 'That repo was not found. Check the name in Backup, and that the token can see it.'
    return `GitHub answered ${error.status}. It will try again.`
  }
  // The sentence has to fit whichever of the two this device is on. The
  // common failure is different in each: a box asleep or a tunnel down on one,
  // no connection at all on the other.
  return syncVia() === 'github'
    ? 'Cannot reach GitHub. It will catch up when there is a connection.'
    : 'Cannot reach the server. Is the PC awake, and Tailscale connected?'
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
