import { useSyncExternalStore } from 'react'
import type { AppData } from './types'
import { getData, holdAutomaticWrites, onStateCommitted, replaceState } from './store'
import { isDemoMode } from './demoMode'
import { isTourSandbox } from './tourMode'
import { isSyncableState, mergeStates, normaliseRemote } from './syncMerge'
import { canSyncThroughGitHub, readSyncState, SyncConflictError, writeSyncState } from './githubSync'
import { GitHubError, summarise } from './cloudBackup'
import { newestStamp } from './clock'
import { dropDeletedFolds, foldInbox } from './later'
import { retireGoals } from './north'

/**
 * The sync client: pull on open, push shortly after every change, and never
 * get in the way.
 *
 * Four rules it holds to, in order of importance:
 *
 * 1. **An older copy is never written over a newer one.** Everything that
 *    goes up is a merge, one entity at a time, against what was read a
 *    moment before - see syncMerge.ts - and a first connection writes
 *    nothing until it has been told which plan to keep. docs/SYNC-AUDIT.md
 *    is every way this rule was broken before v2.34, and the test for each.
 * 2. **It never blocks the UI.** Every call is fire-and-forget. A server that
 *    is asleep, unreachable, or on the other side of a VPN that is not up
 *    costs nothing but a status line - and the day waits at most a few
 *    seconds for the first pull before it opens on what is here.
 * 3. **It never deletes anything because the server disagreed.** A response
 *    that does not look like a state is ignored entirely and reported. The
 *    worst outcome of a broken server has to be "no sync", never "no data".
 * 4. **It is off unless somebody turned it on**, and when it is on, nothing
 *    it does is silent: the last pull, the last push, what waits to go and
 *    every failure are on the status Settings reads.
 *
 * Config lives under its own storage key rather than in the state, because
 * syncing the address of the sync server is circular and a token is a
 * device's own credential. What this device knows about its own syncing -
 * when it joined, when it last pulled and pushed, and whether a change is
 * still owed - is a second key beside it, for the same reason.
 */

const CONFIG_KEY = 'dienius:sync'
const DEVICE_KEY = 'dienius:sync-device'

/** How long after a change to push, to a server. Long enough to coalesce a burst of edits. */
export const PUSH_DEBOUNCE_MS = 2500

/**
 * The same, through GitHub on a computer, where every push is a commit.
 *
 * It was thirty seconds, to keep a morning's planning from becoming four
 * hundred commits. A change then waited half a minute to leave, and the
 * push on leaving the page is a request the browser is free to drop with
 * the page - so the phone picked up in that half minute did not have it
 * (docs/SYNC-AUDIT.md, path 7). Eight seconds still makes one commit of a
 * stretch of typing, and is shorter than picking up the phone.
 */
export const GITHUB_PUSH_DEBOUNCE_MS = 8000

/**
 * And on a phone, which is put away seconds after the last tap, and whose
 * browser suspends a page it can no longer see before most requests it
 * started could finish. Three seconds; and what does not get out before the
 * page goes is remembered and sent first thing on the next open.
 */
export const PHONE_PUSH_DEBOUNCE_MS = 3000

/** A finger rather than a mouse is the phone this is about. */
function onPhone(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

/** Whichever of the three this device is on. */
function pushDelay(): number {
  if (syncVia() !== 'github') return PUSH_DEBOUNCE_MS
  return onPhone() ? PHONE_PUSH_DEBOUNCE_MS : GITHUB_PUSH_DEBOUNCE_MS
}

/**
 * How often an open screen asks whether the other device did something.
 *
 * Pull on coming back to the tab was the whole of "it knows when you pick up
 * the phone", and it leaves one case out: a phone lying open on the desk
 * while the computer is being used. It learned nothing until it was put
 * down and picked up again. A read a minute closes that, and it is a read
 * only - a poll that also wrote would be a commit a minute on the repo route
 * whether or not anything had changed. What this device owes is pushed by
 * the debounce and by leaving, as before.
 */
export const POLL_WHILE_VISIBLE_MS = 60_000

/**
 * How long a day waits for the page's first pull before it is opened on what
 * this device already has.
 *
 * The day view stamps a day's template the moment it mounts. On a page that
 * has just loaded, that was before the first pull had come back - so a phone
 * picked up in the morning stamped its own copy of a day the desktop had
 * already opened and ticked, and the merge kept both (docs/SYNC-AUDIT.md,
 * path 8). A pull through GitHub takes about a second; five is the ceiling
 * on how long the day may look unstamped, and offline it does not wait.
 */
export const FIRST_PULL_WAIT_MS = 5000

/** A pull older than this, on a screen that is open, is a device that may be behind. */
export const BEHIND_AFTER_MS = 3 * 60_000

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

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'error' | 'offline' | 'choice'

/** One side of the first connection's question, the way a person compares two plans. */
export interface PlanSide {
  tasks: number
  days: number
  templates: number
  /** The latest instant anything in it was changed, or null for a plan never touched. */
  changedAt: string | null
}

/**
 * The first connection of a device that has a plan of its own, to a shared
 * copy that has another. Nothing is written until it is answered - see
 * `chooseFirstSync`.
 */
export interface FirstSyncChoice {
  here: PlanSide
  remote: PlanSide
}

export interface SyncStatus {
  phase: SyncPhase
  /** ISO instant of the last completed sync, or null. */
  lastSyncedAt: string | null
  /**
   * ISO instant of the last time a sync brought something in from the other
   * device - a change applied or a deletion carried out - or null if nothing
   * has ever arrived. "Last synced" says this device talked to the meeting
   * place; this says something was there. The question a person actually
   * asks is the second one: does the phone have what I just did?
   */
  lastReceivedAt: string | null
  /** The last time this device read the shared plan and took in what was there. Kept across reloads. */
  lastPullAt: string | null
  /** The last time what this device has went up, or was found already there. Kept across reloads. */
  lastPushAt: string | null
  /** Something a person can read. Never a stack trace, never a status code alone. */
  message: string | null
  /**
   * Why the last pull did not go through, or null. A poll once a minute used
   * to fail in silence, so a phone that could not reach GitHub all afternoon
   * said "Last synced 3 hours ago" and nothing else.
   */
  pullError: string | null
  /** True while a push is owed - the reason "Saved" is not shown yet. */
  pending: boolean
  /** Since when a change here has been waiting to go up, or null. Kept across reloads. */
  owedSince: string | null
  /** The first connection's question, while it waits for an answer. */
  choice: FirstSyncChoice | null
}

/** What this device keeps about its own syncing, beside the config. */
interface DeviceRecord {
  /**
   * When this device first agreed a plan with the shared copy - took it,
   * merged into it, or was the first one there. Null until then, and until
   * then nothing it has is written anywhere.
   */
  joinedAt: string | null
  lastPullAt: string | null
  lastPushAt: string | null
  owedSince: string | null
}

const EMPTY_CONFIG: SyncConfig = { url: '', token: '', enabled: false, via: 'server' }
const EMPTY_DEVICE: DeviceRecord = { joinedAt: null, lastPullAt: null, lastPushAt: null, owedSince: null }

/** Where this device is meeting the other one. */
export function syncVia(): 'server' | 'github' {
  return config.via ?? 'server'
}

let config: SyncConfig = loadConfig()
let device: DeviceRecord = loadDevice()
let status: SyncStatus = initialStatus()

function initialStatus(): SyncStatus {
  return {
    phase: config.enabled ? 'idle' : 'off',
    lastSyncedAt: null,
    lastReceivedAt: null,
    lastPullAt: device.lastPullAt,
    lastPushAt: device.lastPushAt,
    message: null,
    pullError: null,
    pending: config.enabled && device.owedSince !== null,
    owedSince: config.enabled ? device.owedSince : null,
    choice: null,
  }
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
let pollTimer: ReturnType<typeof setInterval> | null = null
/** The answer to the first connection's question, until the round trip it asked for has used it. */
let joining: 'take' | 'merge' | null = null

function startPolling(): void {
  if (pollTimer || typeof document === 'undefined') return
  pollTimer = setInterval(() => {
    if (!config.enabled || document.hidden) return
    void pullOnly()
  }, POLL_WHILE_VISIBLE_MS)
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

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
      // Read back like the rest. It was not, and a device switched on
      // through GitHub read as "a server of your own, no address" after its
      // first reload - and synced nothing, quietly, from then on
      // (docs/SYNC-AUDIT.md, path 1).
      via: parsed.via === 'github' ? 'github' : 'server',
    }
  } catch {
    return { ...EMPTY_CONFIG }
  }
}

function loadDevice(): DeviceRecord {
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    if (!raw) return { ...EMPTY_DEVICE }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const at = (value: unknown) => (typeof value === 'string' ? value : null)
    return {
      joinedAt: at(parsed.joinedAt),
      lastPullAt: at(parsed.lastPullAt),
      lastPushAt: at(parsed.lastPushAt),
      owedSince: at(parsed.owedSince),
    }
  } catch {
    return { ...EMPTY_DEVICE }
  }
}

function updateDevice(patch: Partial<DeviceRecord>): void {
  device = { ...device, ...patch }
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device))
  } catch {
    // A device that cannot keep this asks the first connection's question
    // again on its next open, which is the safe way to be wrong.
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
  setStatus({ phase: config.enabled ? 'idle' : 'off', message: null, choice: null })
  // Switching on here, on a page that booted with sync off, is the one path
  // startSync never sees - so the minute's poll started only on the next
  // return to the tab, and a screen left open after turning sync on learned
  // nothing until then. Started and stopped where the switch is.
  if (config.enabled) {
    void syncNow()
    if (typeof document !== 'undefined' && !document.hidden) startPolling()
  } else {
    stopPolling()
  }
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

/**
 * Whether this device may be showing an older plan than the shared one:
 * the first connection's question unanswered, the last pull failed, or no
 * pull for a while on a screen that is open. What Settings says as "this
 * device is behind".
 */
export function isBehind(s: SyncStatus = status, now = Date.now()): boolean {
  if (s.phase === 'off' || s.phase === 'syncing') return false
  if (s.choice || s.pullError || s.phase === 'error' || s.phase === 'offline') return true
  if (!s.lastPullAt) return true
  return now - Date.parse(s.lastPullAt) > BEHIND_AFTER_MS
}

// --- the first pull, before the day stamps itself ---------------------------

/** True from the page's load until its first pull has come back, while sync is on. */
let holding = false
let holdWaiters: (() => void)[] = []
let holdTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Whether there is anything to try: switched on, a real plan rather than
 * the sample week or the tour's sandbox, and somewhere named to meet. The
 * repo route with no repo in Backup is tried, so that it can say so.
 */
function canTry(): boolean {
  if (!config.enabled || isDemoMode() || isTourSandbox()) return false
  return syncVia() === 'github' || !!config.url
}

function armHold(): void {
  if (holding || !canTry()) return
  if (syncVia() === 'github' && !canSyncThroughGitHub()) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  holding = true
  holdTimer = setTimeout(releaseHold, FIRST_PULL_WAIT_MS)
}

function releaseHold(): void {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
  if (!holding) return
  holding = false
  const waiting = holdWaiters
  holdWaiters = []
  waiting.forEach(fn => fn())
}

// The store asks this before a write it makes on its own - a day stamping
// its template as it opens - and waits when the answer is yes. See
// FIRST_PULL_WAIT_MS.
holdAutomaticWrites({ held: () => holding, then: fn => void holdWaiters.push(fn) })
armHold()

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
    // Remembered, so that a change the page did not live to send is known
    // about - and sent - on the next open.
    if (!device.owedSince) updateDevice({ owedSince: new Date().toISOString() })
    setStatus({ pending: true, owedSince: device.owedSince })
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
        startPolling()
        return
      }
      stopPolling()
      // And going away is the moment to say what this one did, which is the
      // whole of "it knows when you move to the phone": the computer pushes
      // as it is put down, so the phone's own pull on opening already has it.
      // Nothing is owed if nothing changed.
      leave()
    })
    // The page itself going - closed, or discarded from the phone's memory.
    // A round trip cannot finish then; see pushAsThePageGoes.
    window.addEventListener('pagehide', pushAsThePageGoes)
  }

  if (config.enabled) {
    void syncNow()
    if (typeof document !== 'undefined' && !document.hidden) startPolling()
  }
}

/**
 * The push on the way out: now rather than after the debounce, and with
 * `keepalive` where the plan is small enough for the browser to carry the
 * request past the page. Where it is not, or the browser drops it anyway,
 * the change is still owed, and the next open sends it before anything else.
 */
function leave(): void {
  if (!status.pending && !pushTimer) return
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  void syncNow({ leaving: true })
}

/**
 * The page going: one request, carried past it by the browser, or none.
 *
 * A round trip needs the page alive from its read to its write, and a page
 * being closed is not. So the write goes alone, over the version this page
 * last read or wrote - which GitHub refuses if the other device has written
 * since, leaving the change owed rather than written over anything - and
 * only where the plan is small enough for `keepalive`. Anything else waits
 * for the next open, which sends it first (docs/SYNC-AUDIT.md, path 7). The
 * plan here was merged with that version when it was read, so writing it
 * alone is what the round trip would have written.
 *
 * A server of your own has no version to write over, so there it is the
 * round trip, for whatever of it the page lives to finish.
 */
function pushAsThePageGoes(): void {
  if (!status.pending && !pushTimer) return
  if (syncVia() !== 'github' || !device.joinedAt || remoteSha === null) {
    leave()
    return
  }
  if (inFlight) return
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  const sent = getData()
  void writeSyncState(sent, remoteSha, { keepalive: true, onlyIfCarried: true })
    .then(result => {
      if (!result.written) return
      remoteSha = result.sha
      const at = new Date().toISOString()
      const caughtUp = getData() === sent
      updateDevice({ lastPushAt: at, owedSince: caughtUp ? null : device.owedSince })
      setStatus({ lastPushAt: at, pending: !caughtUp, owedSince: device.owedSince })
    })
    .catch(() => {
      // Refused or dropped: still owed, and sent on the next open.
    })
}

/**
 * Half a round trip: read what the other device left, merge it in, and write
 * nothing back. What this device owes is somebody else's job - the debounce,
 * or leaving the screen - so this can run every minute without a commit a
 * minute. See POLL_WHILE_VISIBLE_MS.
 *
 * Joins a round trip already in the air rather than racing it, the same way
 * syncNow does.
 */
export function pullOnly(): Promise<void> {
  if (!canTry()) return Promise.resolve()
  if (inFlight) return inFlight
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve()
  inFlight = runPull().finally(() => {
    inFlight = null
    releaseHold()
  })
  return inFlight
}

async function runPull(): Promise<void> {
  // A device that has not joined yet answers the first connection's question
  // in a full round trip, never in a poll - see runSync.
  if (!device.joinedAt) return
  try {
    const remote = await request('GET')
    if (remote === null) return
    if (!isSyncableState(remote)) {
      fail('The server answered with something that is not a plan. Nothing was changed here.')
      return
    }
    const now = new Date().toISOString()
    const theirs = normaliseRemote(remote)
    const merged = mergeStates(getData(), theirs, now)
    const folded = retireGoals(dropDeletedFolds(foldInbox(merged.data, now), theirs.tombstones, now), now)
    const arrived = merged.applied > 0 || merged.deleted > 0
    if (arrived || folded !== merged.data) replaceState(folded)
    notePull(now, arrived)
  } catch (error) {
    // Said, never swallowed. It used to be: a status line flickering to red
    // once a minute over a phone in a tunnel seemed worse than silence, and
    // the silence turned out to be a phone that could not reach GitHub all
    // afternoon saying only when it had last synced. It is its own line, so
    // the rest of the status - the last push, what is owed - still reads.
    setStatus({ pullError: describe(error) })
  }
}

/** A pull that came back and was taken in. */
function notePull(now: string, arrived: boolean): void {
  updateDevice({ lastPullAt: now })
  setStatus({
    lastSyncedAt: now,
    lastPullAt: now,
    pullError: null,
    ...(arrived ? { lastReceivedAt: now } : {}),
  })
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

/**
 * One full round trip: read what the server has, merge it in, write back the
 * result.
 *
 * Push and pull are the same operation on purpose. Sending only local changes
 * would need a record of what the server has already seen, which is a second
 * kind of state to get wrong; the whole state is a few hundred kilobytes and
 * this runs on a home network.
 */
export function syncNow(options: { leaving?: boolean } = {}): Promise<void> {
  // "Nothing to reach" is a different question for each route: a server needs
  // an address typed in, and the repo needs the one Backup already holds.
  // The sample week is not anybody's plan and must never reach a server where
  // a real device would merge it in, and neither must the tour's sandbox: a
  // starter template stamped onto today by somebody replaying the tour must
  // never reach their real devices.
  if (!canTry()) {
    releaseHold()
    return Promise.resolve()
  }
  // Only the server route can be misconfigured this way; GitHub is https.
  if (syncVia() === 'server' && blockedByMixedContent(config.url)) {
    releaseHold()
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
    releaseHold()
    setStatus({ phase: 'offline', message: 'No connection. It will catch up.' })
    return Promise.resolve()
  }

  changedDuringSync = false
  setStatus({ phase: 'syncing', message: null })
  inFlight = runSync(0, options.leaving === true).finally(() => {
    inFlight = null
    releaseHold()
    // Whatever changed mid-flight was not in the state that just went up.
    if (changedDuringSync && status.phase !== 'error' && status.phase !== 'choice') schedulePush()
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

async function runSync(attempt: number, leaving: boolean): Promise<void> {
  try {
    const remote = await request('GET')
    if (remote !== null && !isSyncableState(remote)) {
      // Conservative by design: something is on the other end and it is not a
      // Dienius state. Nothing local is touched.
      fail('The server answered with something that is not a plan. Nothing was changed here.')
      return
    }

    const now = new Date().toISOString()

    // The first connection - docs/SYNC-AUDIT.md, path 4. It used to merge on
    // the spot, which put a phone's own plan into the desktop's, and gave a
    // phone's first-run choices, stamped later than the desktop's older
    // ones, the win everywhere. Now a device with nothing of its own takes
    // the shared plan whole, and one with a plan of its own is asked first;
    // either way nothing is written before that. The first device there has
    // nothing to be asked about, and goes up as it is.
    if (!device.joinedAt && remote !== null) {
      const theirs = normaliseRemote(remote)
      const how = joining ?? (hasOwnPlan(getData()) ? null : 'take')
      if (how === null) {
        setStatus({
          phase: 'choice',
          message: null,
          choice: { here: sideOf(getData()), remote: sideOf(theirs) },
        })
        return
      }
      if (how === 'take') {
        take(theirs, now)
        return
      }
      // 'merge': the ordinary round trip below, and joined once it has written.
    }

    const local = getData()
    const merged =
      remote === null ? { data: local, applied: 0, deleted: 0 } : mergeStates(local, normaliseRemote(remote), now)

    // A merge result never passes through loadData, so the fold that turns
    // an older device's inbox into Later has to run here as well - before
    // the result is committed and before it goes back to the server, or the
    // server would hold a line under a name this device no longer reads.
    // See later.ts. Goals an older device still holds active are retired
    // here for the same reason - see retireGoals in north.ts.
    const folded = retireGoals(
      dropDeletedFolds(
        foldInbox(merged.data, now),
        remote === null ? undefined : normaliseRemote(remote).tombstones,
        now,
      ),
      now,
    )
    const arrived = merged.applied > 0 || merged.deleted > 0
    if (arrived || folded !== merged.data) replaceState(folded)
    notePull(now, arrived)

    try {
      await request('POST', folded, leaving)
    } catch (error) {
      // The shared copy moved between the read and the write, so what is in
      // hand was merged against a plan that is no longer the latest. Pull and
      // merge again rather than writing over what the other device just did -
      // see githubSync.ts, which is the only transport that can tell.
      if (error instanceof SyncConflictError && attempt < CONFLICT_RETRIES) {
        remoteSha = null
        return await runSync(attempt + 1, leaving)
      }
      throw error
    }

    // Anything committed while the write was in the air is not in it, and
    // is still owed.
    const pushedAt = new Date().toISOString()
    const caughtUp = getData() === folded
    joining = null
    updateDevice({
      joinedAt: device.joinedAt ?? pushedAt,
      lastPushAt: pushedAt,
      owedSince: caughtUp ? null : (device.owedSince ?? pushedAt),
    })
    retryDelay = RETRY_BASE_MS
    setStatus({
      phase: 'idle',
      lastSyncedAt: pushedAt,
      lastPushAt: pushedAt,
      message: null,
      pullError: null,
      pending: !caughtUp,
      owedSince: device.owedSince,
      choice: null,
    })
    if (!caughtUp) changedDuringSync = true
  } catch (error) {
    fail(describe(error))
  }
}

/**
 * The shared plan, taken whole: this device's own is replaced, settings and
 * all, and nothing is written - the shared copy is already what this device
 * now has. Through `replaceState`, so nothing is stamped: a plan taken is
 * not a plan changed, and must not look newer than itself on the next sync.
 */
function take(theirs: AppData, now: string): void {
  const folded = retireGoals(dropDeletedFolds(foldInbox(theirs, now), theirs.tombstones, now), now)
  replaceState(folded)
  joining = null
  updateDevice({ joinedAt: now, lastPullAt: now, owedSince: null })
  retryDelay = RETRY_BASE_MS
  setStatus({
    phase: 'idle',
    lastSyncedAt: now,
    lastPullAt: now,
    lastReceivedAt: now,
    message: null,
    pullError: null,
    pending: false,
    owedSince: null,
    choice: null,
  })
}

/**
 * The answer to the first connection's question.
 *
 * `take` replaces this device's plan with the shared one and writes
 * nothing; `merge` joins the two one entity at a time, the later change
 * winning where both changed the same thing, and sends the result up. The
 * shared copy is read again for either, so the answer is applied to what is
 * there now rather than to what was there when the question was asked.
 */
export async function chooseFirstSync(how: 'take' | 'merge'): Promise<void> {
  if (device.joinedAt && !status.choice) return
  joining = how
  setStatus({ choice: null })
  if (inFlight) await inFlight
  await syncNow()
}

/**
 * Whether a device holds anything a person made, as against the defaults a
 * fresh install starts with and the choices its first run asks for. A plan
 * without any of it is taken whole on the first connection, without asking.
 */
function hasOwnPlan(data: AppData): boolean {
  const s = summarise(data)
  return s.tasks + s.templates + s.books + s.north + s.later + s.recipes + s.routines + data.scratch.length > 0
}

function sideOf(data: AppData): PlanSide {
  const s = summarise(data)
  return { tasks: s.tasks, days: s.days, templates: s.templates, changedAt: newestStamp(data) }
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

/** A request the browser may carry past the page is capped at 64 KB, body and all. */
const KEEPALIVE_MAX_CHARS = 60_000

async function request(method: 'GET' | 'POST', body?: unknown, leaving = false): Promise<unknown> {
  if (syncVia() === 'github') {
    if (!canSyncThroughGitHub()) {
      throw new SyncError('Sync is set to use the GitHub repo, and there is no repo or token in Backup yet.')
    }
    if (method === 'GET') {
      const read = await readSyncState()
      remoteSha = read.sha
      return read.state
    }
    const written = await writeSyncState(body, remoteSha, { keepalive: leaving })
    // The version now there, so a write as the page goes can name it.
    if (written.written) remoteSha = written.sha
    return null
  }
  const payload = body !== undefined ? JSON.stringify(body) : undefined
  const response = await fetch(`${config.url}/state`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: payload,
    ...(leaving && payload !== undefined && payload.length < KEEPALIVE_MAX_CHARS ? { keepalive: true } : {}),
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
  // Lost the lock three times running: both devices busy, not a network
  // down. It said "Cannot reach GitHub", which sent the owner looking at
  // the wrong thing.
  if (error instanceof SyncConflictError) {
    return 'The other device kept writing while this one was merging. It will try again in a moment.'
  }
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
  stopPolling()
  if (pushTimer) clearTimeout(pushTimer)
  if (retryTimer) clearTimeout(retryTimer)
  pushTimer = null
  retryTimer = null
  retryDelay = RETRY_BASE_MS
  inFlight = null
  changedDuringSync = false
  joining = null
  stopCommitWatch?.()
  stopCommitWatch = null
  started = false
  config = { ...EMPTY_CONFIG }
  device = { ...EMPTY_DEVICE }
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
  holding = false
  holdWaiters = []
  status = initialStatus()
  listeners.clear()
}

/**
 * Test seam: this device has joined already - took the shared plan, or merged
 * into it, or was first - so a round trip merges rather than asking the first
 * connection's question.
 */
export function markJoinedForTests(at = '2026-01-01T00:00:00.000Z'): void {
  updateDevice({ joinedAt: at })
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
