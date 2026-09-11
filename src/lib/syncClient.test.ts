import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  formatSyncedAt,
  getSyncConfig,
  getSyncStatus,
  resetSyncForTests,
  setSyncConfig,
  syncNow,
} from './syncClient'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { setCloudBackupConfig } from './cloudBackup'
import type { AppData } from './types'

const DATE = '2026-09-01'
const URL = 'http://sync.test:8787'

/**
 * What these test is the client's judgement, not its plumbing: what it does
 * when the server is empty, absent, wrong, or holding something a person
 * would be upset to lose. The merge itself is covered in syncMerge.test.ts.
 */

let fetchMock: ReturnType<typeof vi.fn>

/** A server that answers a GET with `state` and accepts any POST. */
function serverHolding(state: AppData | null) {
  const posted: AppData[] = []
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
    if (init.method === 'POST') {
      posted.push(JSON.parse(init.body as string) as AppData)
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify(state), { status: 200 }))
  })
  return posted
}

beforeEach(() => {
  localStorage.clear()
  resetSyncForTests()
  actions.resetForTests(defaultData())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  resetSyncForTests()
  vi.unstubAllGlobals()
  // Spies are not globals: the offline test replaces navigator.onLine's getter,
  // and unstubAllGlobals leaves it replaced. Every test after it then took the
  // early return in syncNow and passed by never doing anything.
  vi.restoreAllMocks()
})

test('nothing goes over the wire until somebody turns it on', async () => {
  await syncNow()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSyncStatus().phase).toBe('off')
})

test('turning it on stores the address and the token, so the next open is already syncing', () => {
  serverHolding(null)
  setSyncConfig({ url: `${URL}/`, token: 'abc', enabled: true })
  // The trailing slash is dropped on the way in, because every request path
  // is built by appending one.
  expect(getSyncConfig().url).toBe(URL)
  expect(JSON.parse(localStorage.getItem('dienius:sync')!)).toEqual({ url: URL, token: 'abc', enabled: true })
})

test('the token rides in the Authorization header and never in the URL', async () => {
  serverHolding(null)
  setSyncConfig({ url: URL, token: 'secret-token', enabled: true })
  await syncNow()

  const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(calledUrl).toBe(`${URL}/state`)
  expect(calledUrl).not.toContain('secret-token')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token')
})

test('an empty server gets this device pushed to it, and nothing local changes', async () => {
  actions.addTask(DATE, 'Gym')
  const before = getData()
  const posted = serverHolding(null)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })

  await syncNow()

  expect(getData()).toBe(before)
  expect(posted[0].days[DATE].tasks.map(t => t.title)).toEqual(['Gym'])
  expect(getSyncStatus().phase).toBe('idle')
})

test('what the other device did arrives, and what this one did survives it', async () => {
  actions.addTask(DATE, 'On the PC')

  const remote = defaultData()
  remote.days[DATE] = {
    date: DATE,
    tasks: [{ id: 'phone-1', title: 'On the phone', done: false, updatedAt: '2026-09-01T08:00:00.000Z' }],
    updatedAt: '2026-09-01T08:00:00.000Z',
  } as AppData['days'][string]
  const posted = serverHolding(remote)

  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  const titles = getData().days[DATE].tasks.map(t => t.title).sort()
  expect(titles).toEqual(['On the PC', 'On the phone'])
  // And the merged result is what goes back, so the other device gets both too.
  expect(posted.at(-1)!.days[DATE].tasks).toHaveLength(2)
})

// An older device still has an inbox and pushes it. The merge lets its lines
// in under their old kind so the tombstones can meet them; what survives is
// folded into Later before anything is committed here or posted back, so
// the server never holds a line under a name this device no longer reads.
// See lib/later.ts.
// Device A deleted an inbox line while this device was away, and this
// device folded the same line into Later at its next open, before it could
// sync. A's inbox tombstone must still win over the folded row, or a thing
// deleted once would stand on both devices. See dropDeletedFolds in
// lib/later.ts.
test('a line deleted on another device before this one folded it does not come back through the merge', async () => {
  actions.resetForTests({
    ...defaultData(),
    backlog: [{ id: 'phone-line', title: 'Deleted on the phone', updatedAt: '2026-09-01T08:00:00.000Z' }],
    tombstones: { 'inbox:phone-line': '2026-09-03T08:00:00.000Z' },
  })

  const remote = defaultData()
  remote.tombstones = { 'inbox:phone-line': '2026-09-02T08:00:00.000Z' }
  const posted = serverHolding(remote)

  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(getData().backlog).toEqual([])
  expect(getData().tombstones?.['backlog:phone-line']).toEqual(expect.any(String))
  const back = posted.at(-1)!
  expect(back.backlog).toEqual([])
  expect(back.tombstones?.['backlog:phone-line']).toEqual(expect.any(String))
})

test('a remote that still carries an inbox arrives folded into Later', async () => {
  actions.addLaterItem({ title: 'On the PC' })

  const remote = defaultData()
  remote.inbox = [{ id: 'phone-line', text: 'On the phone', captured: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }]
  const posted = serverHolding(remote)

  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(getData().inbox).toEqual([])
  expect(getData().backlog.map(i => i.title)).toEqual(['On the phone', 'On the PC'])
  expect(getData().tombstones?.['inbox:phone-line']).toEqual(expect.any(String))
  // And what goes back is the folded state, so the phone deletes its copy
  // and finds the same line in its Later on the next round trip.
  const back = posted.at(-1)!
  expect(back.inbox).toEqual([])
  expect(back.backlog.map(i => i.id)).toContain('phone-line')
  expect(back.tombstones?.['inbox:phone-line']).toEqual(expect.any(String))
})

/**
 * The rule that matters more than any feature here. A server answering with
 * a login page, a proxy error, or somebody else's JSON must never be treated
 * as an empty plan - that reading deletes everything.
 */
test('a reply that is not a plan changes nothing here, and says so', async () => {
  actions.addTask(DATE, 'Gym')
  const before = getData()
  fetchMock.mockResolvedValue(new Response('{"error":"who are you"}', { status: 200 }))

  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(getData()).toBe(before)
  expect(getData().days[DATE].tasks).toHaveLength(1)
  expect(getSyncStatus().phase).toBe('error')
  // No POST either: a server this confused is not one to write to.
  expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).method !== 'POST')).toBe(true)
})

test('a refused token is reported as a refused token, not as a number', async () => {
  fetchMock.mockResolvedValue(new Response('{"error":"bad token"}', { status: 401 }))
  setSyncConfig({ url: URL, token: 'wrong', enabled: true })
  await syncNow()

  expect(getSyncStatus().phase).toBe('error')
  expect(getSyncStatus().message).toMatch(/token/i)
})

test('an unreachable server is a sentence about the PC, not a TypeError', async () => {
  actions.addTask(DATE, 'Gym')
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(getSyncStatus().phase).toBe('error')
  expect(getSyncStatus().message).toMatch(/PC|Tailscale/)
  expect(getData().days[DATE].tasks).toHaveLength(1)
})

test('offline is not an error - it is a wait', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSyncStatus().phase).toBe('offline')
})

test('turning it off stops it dead', async () => {
  serverHolding(null)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()
  fetchMock.mockClear()

  setSyncConfig({ url: URL, token: 'abc', enabled: false })
  await syncNow()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSyncStatus().phase).toBe('off')
})

test('syncing twice against an unchanged server settles rather than ping-ponging', async () => {
  actions.addTask(DATE, 'Gym')
  let held: AppData | null = null
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
    if (init.method === 'POST') {
      held = JSON.parse(init.body as string) as AppData
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify(held), { status: 200 }))
  })

  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()
  const after = getData()
  await syncNow()

  // Identity, not equality: a second sync that rebuilt the state would
  // re-render the whole app every time the tab regained focus.
  expect(getData()).toBe(after)
})

test('a broken localStorage config reads as no config rather than throwing on boot', () => {
  localStorage.setItem('dienius:sync', 'not json')
  // Re-reading is what a fresh page load does; the module does it once at
  // import, and resetSyncForTests puts it back to the same empty shape.
  resetSyncForTests()
  // `via` joined the shape in v2.21, when the repo became somewhere two
  // devices can meet without a server between them. Empty still means off.
  expect(getSyncConfig()).toEqual({ url: '', token: '', enabled: false, via: 'server' })
})

test('the last-synced line reads as a person would say it', () => {
  const now = Date.parse('2026-09-01T12:00:00.000Z')
  expect(formatSyncedAt(null, now)).toBe('not yet')
  expect(formatSyncedAt('2026-09-01T11:59:50.000Z', now)).toBe('just now')
  expect(formatSyncedAt('2026-09-01T11:56:00.000Z', now)).toBe('4 min ago')
  expect(formatSyncedAt('2026-09-01T11:00:00.000Z', now)).toBe('1 hour ago')
  expect(formatSyncedAt('2026-08-30T12:00:00.000Z', now)).toBe('2 days ago')
})

/**
 * Two devices whose round trips overlap: both read, then both write, and the
 * second write lands on top of a state that never saw the first one.
 *
 * There is no locking, and there deliberately is not going to be - one person
 * with two devices does not need a transaction log. What makes it safe is that
 * nothing is ever lost locally: the device whose change got overwritten still
 * has it, and its next sync puts it back. This pins that self-healing, because
 * without it the answer to "did that get through?" would be "sometimes".
 */
test('a push that lands on top of another device sorts itself out on the next sync', async () => {
  actions.addTask(DATE, 'Mine')
  const mine = getData()

  // The other device wrote while this one was mid-round-trip, so the server
  // now holds a state that has never seen "Mine".
  const theirs = defaultData()
  theirs.days[DATE] = {
    date: DATE,
    tasks: [{ id: 'theirs', title: 'Theirs', done: false, updatedAt: '2026-09-01T09:00:00.000Z' }],
    updatedAt: '2026-09-01T09:00:00.000Z',
  } as AppData['days'][string]

  const posted = serverHolding(theirs)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(getData().days[DATE].tasks.map(t => t.title).sort()).toEqual(['Mine', 'Theirs'])
  expect(posted.at(-1)!.days[DATE].tasks).toHaveLength(2)
  expect(mine.days[DATE].tasks[0].title).toBe('Mine')
})

// Restoring a snapshot is a decision made now - see actions.restoreState. It
// has to beat whatever the other device is still holding, or the restore
// silently undoes itself a few seconds later.
test('a restored snapshot survives the sync that follows it', async () => {
  actions.addTask(DATE, 'Typed today')
  const server = getData()

  const snapshot = defaultData()
  snapshot.days['2026-08-20'] = {
    date: '2026-08-20',
    tasks: [{ id: 'old', title: 'From the snapshot', done: false, updatedAt: '2026-08-20T09:00:00.000Z' }],
  } as AppData['days'][string]

  actions.restoreState(snapshot)
  serverHolding(server)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  expect(Object.keys(getData().days)).toEqual(['2026-08-20'])
  expect(getData().days['2026-08-20'].tasks[0].title).toBe('From the snapshot')
})

/**
 * An https page cannot call an http endpoint, and the browser refuses it with
 * the same generic network error a sleeping PC gives. Told "is the PC awake"
 * about a PC that is awake, over an address that can never work, somebody
 * spends an evening on it. Named rather than guessed at.
 */
test('an http server on an https page is named as the problem, not blamed on the PC', async () => {
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, protocol: 'https:' } as Location)

  setSyncConfig({ url: 'http://100.64.0.1:8787', token: 'abc', enabled: true })
  await syncNow()

  expect(fetchMock).not.toHaveBeenCalled()
  expect(getSyncStatus().message).toMatch(/https/)
  expect(getSyncStatus().message).toMatch(/tailscale serve/)
})

test('an https server on an https page is left alone', async () => {
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, protocol: 'https:' } as Location)
  serverHolding(null)

  setSyncConfig({ url: 'https://pc.tail1234.ts.net', token: 'abc', enabled: true })
  await syncNow()

  expect(fetchMock).toHaveBeenCalled()
  expect(getSyncStatus().phase).toBe('idle')
})

// A dev server on http talking to localhost is the ordinary case and must not
// trip the guard.
test('localhost over http is fine from an http page', async () => {
  serverHolding(null)
  setSyncConfig({ url: 'http://localhost:8787', token: 'abc', enabled: true })
  await syncNow()
  expect(getSyncStatus().phase).toBe('idle')
})

// --- meeting in the repo instead of on a server --------------------------

/**
 * The same client, through GitHub, which is the answer to "how do the two
 * devices see each other without me running anything".
 *
 * What is tested here is the one thing this route can do that a plain server
 * cannot: refuse to write over a version it did not read, and start the round
 * trip again instead. Last write wins is the wrong answer when both writers
 * are the same person on two machines.
 */
function repoHolding(state: AppData | null, putAnswers: number[] = []) {
  const written: AppData[] = []
  let sha = state === null ? null : 'sha-1'
  let held = state
  fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
    if (init.method === 'PUT') {
      const answer = putAnswers.shift() ?? 200
      if (answer !== 200) return Promise.resolve(new Response('{"message":"conflict"}', { status: answer }))
      const body = JSON.parse(String(init.body)) as { content: string }
      held = JSON.parse(atob(body.content)) as AppData
      written.push(held)
      sha = `sha-${written.length + 1}`
      return Promise.resolve(new Response('{}', { status: 200 }))
    }
    if (held === null) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(held))))
    return Promise.resolve(new Response(JSON.stringify({ sha, content }), { status: 200 }))
  })
  return { written, reads: () => fetchMock.mock.calls.filter(c => (c[1]?.method ?? 'GET') === 'GET').length }
}

function turnOnThroughGitHub() {
  localStorage.setItem('dienius:cloud-backup', JSON.stringify({ repo: 'someone/dienius-data', token: 'github_pat_secret', lastBackupAt: null }))
  setCloudBackupConfig({ repo: 'someone/dienius-data', token: 'github_pat_secret' })
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
}

test('through the repo, what this device holds ends up in the file', async () => {
  actions.addTask(DATE, 'Call the bank')
  const repo = repoHolding(null)
  turnOnThroughGitHub()
  await syncNow()

  expect(repo.written).toHaveLength(1)
  expect(JSON.stringify(repo.written[0])).toContain('Call the bank')
  expect(getSyncStatus().phase).toBe('idle')
})

test('a write refused because the other device got there first is merged again, not forced', async () => {
  actions.addTask(DATE, 'Call the bank')
  // The first PUT is refused; the round trip starts over, reads what is
  // there now, merges, and writes that.
  const repo = repoHolding(null, [409])
  turnOnThroughGitHub()
  await syncNow()

  expect(getSyncStatus().phase).toBe('idle')
  expect(repo.written).toHaveLength(1)
  // Two reads: the first round trip's and the one the conflict sent it back
  // for. A single read with two writes would be the bug this guards.
  expect(repo.reads()).toBe(2)
})

test('a repo that keeps refusing is reported rather than hammered', async () => {
  actions.addTask(DATE, 'Call the bank')
  repoHolding(null, [409, 409, 409, 409])
  turnOnThroughGitHub()
  await syncNow()

  expect(getSyncStatus().phase).toBe('error')
  // Nothing local was touched, which is the rule that matters when a remote
  // misbehaves.
  expect(getData().days[DATE].tasks[0].title).toBe('Call the bank')
})

test('the repo route says so when Backup has no repo in it yet', async () => {
  setCloudBackupConfig({ repo: '', token: '' })
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()

  expect(getSyncStatus().phase).toBe('error')
  expect(getSyncStatus().message).toMatch(/repo or token in Backup/)
})

/**
 * A day cleared on one device stays cleared on the other.
 *
 * The owner's report: today was cleared on the computer, the phone was opened
 * and today was still there. A deletion is the one change a merge cannot read
 * off the state, because "gone here" and "not arrived here yet" look
 * identical - which is what tombstones are for, and what this walks end to
 * end rather than at the merge alone.
 */
test('a day cleared here does not come back from a remote that still holds it', async () => {
  // Yesterday on both devices, today stamped and cleared on this one.
  actions.addTask(DATE, 'Gym')
  actions.addTask(DATE, 'Call the bank')
  const before = getData().days[DATE].tasks.map(t => ({ ...t }))
  expect(before).toHaveLength(2)

  // The other device still has the day as it was, and says so with an older
  // stamp than the clearing.
  const remote = defaultData()
  remote.days[DATE] = {
    date: DATE,
    templateId: 'working',
    tasks: before.map(t => ({ ...t, updatedAt: '2026-09-01T06:00:00.000Z' })),
    updatedAt: '2026-09-01T06:00:00.000Z',
  } as AppData['days'][string]

  actions.clearDay(DATE)
  expect(getData().days[DATE].tasks).toHaveLength(0)

  const posted = serverHolding(remote)
  setSyncConfig({ url: URL, token: 'abc', enabled: true })
  await syncNow()

  // Still cleared here...
  expect(getData().days[DATE].tasks).toHaveLength(0)
  // ...and what goes back says so, so the other device clears too.
  expect(posted.at(-1)!.days[DATE].tasks).toHaveLength(0)
})
