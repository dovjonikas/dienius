import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  BACKUP_MIN_INTERVAL_MS,
  describeFailure,
  describeSummary,
  formatBackupTime,
  fromBase64,
  getCloudBackupConfig,
  getCloudBackupStatus,
  historyPath,
  markDirtyForTests,
  previewRestore,
  requestCloudBackup,
  resetCloudBackupForTests,
  setCloudBackupConfig,
  startCloudBackup,
  STATE_PATH,
  summarise,
  toBase64,
  GitHubError,
} from './cloudBackup'
import { actions, getData } from './store'
import { defaultData, exportJson } from './storage'
import { collectEntities } from './syncEntities'
import { todayKey } from './dates'

/**
 * The third copy of the plan, in a repo the owner holds. What is held here:
 * the shape of what goes over the wire, the optimistic lock on every write,
 * the spacing of automatic pushes, the restore that describes before it
 * replaces, and - above all - that the token is in no export, no sync
 * payload and nothing but its own key.
 */

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | null
}

let calls: Call[]
/** What GET answers per path: a sha, or nothing (404). */
let stored: Map<string, { sha: string; content: string }>
/** Statuses to answer the next PUTs with, consumed in order; then 200. */
let putAnswers: number[]

function respond(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET'
  const headers = (init.headers ?? {}) as Record<string, string>
  const path = url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, '')
  const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
  calls.push({ url, method, headers, body })
  if (method === 'GET') {
    const file = stored.get(path)
    if (!file) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))
    if (headers.Accept === 'application/vnd.github.raw+json') return Promise.resolve(new Response(file.content, { status: 200 }))
    return Promise.resolve(new Response(JSON.stringify({ sha: file.sha, content: toBase64(file.content) }), { status: 200 }))
  }
  const answer = putAnswers.shift() ?? 200
  if (answer !== 200) return Promise.resolve(new Response('{"message":"conflict"}', { status: answer }))
  const sha = `sha-${calls.length}`
  stored.set(path, { sha, content: fromBase64(String(body!.content)) })
  return Promise.resolve(new Response(JSON.stringify({ content: { sha } }), { status: 200 }))
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetCloudBackupForTests()
  calls = []
  stored = new Map()
  putAnswers = []
  vi.stubGlobal('fetch', vi.fn(respond))
  setCloudBackupConfig({ repo: 'quicasha/dienius-data', token: 'github_pat_secret' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- the token stays here ------------------------------------------------------

test('the token is under its own key, and nowhere in the plan, the export or the sync payload', () => {
  actions.addTask(todayKey(), 'Call the bank')
  const plan = JSON.stringify(getData())
  expect(plan).not.toContain('github_pat_secret')
  expect(exportJson(getData())).not.toContain('github_pat_secret')
  expect(JSON.stringify([...collectEntities(getData()).entries()])).not.toContain('github_pat_secret')
  expect(localStorage.getItem('dienius:cloud-backup')).toContain('github_pat_secret')
  expect(localStorage.getItem('dienius:data') ?? '').not.toContain('github_pat_secret')
})

test('the token rides in the Authorization header and never in the URL', async () => {
  markDirtyForTests()
  await requestCloudBackup('manual')
  for (const call of calls) {
    expect(call.url).not.toContain('github_pat_secret')
    expect(call.headers.Authorization).toBe('Bearer github_pat_secret')
  }
})

test('a repo pasted as a GitHub address is kept as owner/name', () => {
  setCloudBackupConfig({ repo: 'https://github.com/quicasha/dienius-data.git', token: 't' })
  expect(getCloudBackupConfig().repo).toBe('quicasha/dienius-data')
})

// --- what goes over the wire -------------------------------------------------------

test('a push writes the whole plan to data/state.json and to the day file, base64 of the pretty JSON', async () => {
  actions.addTask(todayKey(), 'Call the bank')
  const today = todayKey()
  await requestCloudBackup('manual')

  const puts = calls.filter(c => c.method === 'PUT')
  expect(puts.map(c => c.url.split('/contents/')[1])).toEqual([STATE_PATH, historyPath(today)])
  for (const put of puts) {
    expect(typeof put.body!.message).toBe('string')
    const written = JSON.parse(fromBase64(String(put.body!.content)))
    expect(written.days[today].tasks[0].title).toBe('Call the bank')
    expect(fromBase64(String(put.body!.content))).toBe(JSON.stringify(getData(), null, 2))
  }
  expect(getCloudBackupStatus().phase).toBe('idle')
  expect(getCloudBackupStatus().lastBackupAt).not.toBeNull()
  expect(getCloudBackupConfig().lastBackupAt).toBe(getCloudBackupStatus().lastBackupAt)
})

test('a first write sends no sha, and a write over an existing file sends the sha it read', async () => {
  markDirtyForTests()
  await requestCloudBackup('manual')
  const first = calls.filter(c => c.method === 'PUT')
  expect(first[0].body!.sha).toBeUndefined()

  const shaAfterFirst = stored.get(STATE_PATH)!.sha
  calls = []
  await requestCloudBackup('manual')
  const second = calls.filter(c => c.method === 'PUT')
  expect(second[0].body!.sha).toBe(shaAfterFirst)
})

test('a sha conflict is answered by reading the new sha and writing once more', async () => {
  stored.set(STATE_PATH, { sha: 'old', content: '{}' })
  putAnswers = [409]
  markDirtyForTests()
  const ok = await requestCloudBackup('manual')
  expect(ok).toBe(true)
  const statePuts = calls.filter(c => c.method === 'PUT' && c.url.endsWith(STATE_PATH))
  expect(statePuts).toHaveLength(2)
  expect(statePuts[0].body!.sha).toBe('old')
  const gets = calls.filter(c => c.method === 'GET' && c.url.endsWith(STATE_PATH))
  expect(gets.length).toBeGreaterThanOrEqual(2)
})

test('a second conflict in a row is reported, not hidden, and nothing local changes', async () => {
  stored.set(STATE_PATH, { sha: 'old', content: '{}' })
  putAnswers = [409, 409]
  actions.addTask(todayKey(), 'Still here')
  markDirtyForTests()
  const ok = await requestCloudBackup('manual')
  expect(ok).toBe(false)
  expect(getCloudBackupStatus().phase).toBe('error')
  expect(getCloudBackupStatus().message).toMatch(/same moment|try again/)
  expect(getData().days[todayKey()].tasks[0].title).toBe('Still here')
})

test('a refused token says what to check, in words', async () => {
  putAnswers = [401]
  markDirtyForTests()
  await requestCloudBackup('manual')
  expect(getCloudBackupStatus().phase).toBe('error')
  expect(getCloudBackupStatus().message).toMatch(/token/i)
  expect(getCloudBackupStatus().message).not.toMatch(/^Error/)
})

test('failures are sentences that name the thing to check', () => {
  expect(describeFailure(new GitHubError(404, ''))).toMatch(/repo was not found/)
  expect(describeFailure(new GitHubError(403, ''))).toMatch(/token/)
  expect(describeFailure(new GitHubError(500, ''))).toMatch(/500.*try again/)
  expect(describeFailure(new TypeError('Failed to fetch'))).toMatch(/Cannot reach GitHub/)
})

test('base64 survives text past Latin-1', () => {
  const text = JSON.stringify({ title: 'Kavinė „Šaltinis“ - 15 min' })
  expect(fromBase64(toBase64(text))).toBe(text)
})

// --- when it pushes --------------------------------------------------------------

test('nothing goes over the wire with no repo and token', async () => {
  resetCloudBackupForTests()
  markDirtyForTests()
  expect(await requestCloudBackup('manual')).toBe(false)
  expect(calls).toHaveLength(0)
  expect(getCloudBackupStatus().phase).toBe('off')
})

test('an automatic push is skipped when nothing changed, and spaced by ten minutes when something did', async () => {
  expect(await requestCloudBackup('evening-close')).toBe(false)
  expect(calls).toHaveLength(0)

  markDirtyForTests()
  const now = Date.now()
  expect(await requestCloudBackup('evening-close', now)).toBe(true)
  const writes = calls.length

  markDirtyForTests()
  expect(await requestCloudBackup('new-day', now + 60_000)).toBe(false)
  expect(calls).toHaveLength(writes)

  expect(await requestCloudBackup('new-day', now + BACKUP_MIN_INTERVAL_MS + 1)).toBe(true)
  expect(calls.length).toBeGreaterThan(writes)
})

test('a manual press goes now, whatever the spacing', async () => {
  markDirtyForTests()
  const now = Date.now()
  await requestCloudBackup('manual', now)
  const writes = calls.length
  await requestCloudBackup('manual', now + 1000)
  expect(calls.length).toBeGreaterThan(writes)
})

test('the first open of a new day pushes, so yesterday is fixed in its final state', async () => {
  // A copy from yesterday, and a change since.
  localStorage.setItem(
    'dienius:cloud-backup',
    JSON.stringify({ repo: 'quicasha/dienius-data', token: 'github_pat_secret', lastBackupAt: '2020-01-01T21:40:00.000Z' }),
  )
  resetCloudBackupForTests()
  setCloudBackupConfig({ repo: 'quicasha/dienius-data', token: 'github_pat_secret' })
  startCloudBackup()
  await vi.waitFor(() => expect(calls.filter(c => c.method === 'PUT').length).toBeGreaterThan(0))
})

test('a change made after the copy is what marks the plan as changed', async () => {
  startCloudBackup()
  // Consumes the new-day push, if any.
  await Promise.resolve()
  calls = []
  await requestCloudBackup('manual')
  calls = []
  actions.addTask(todayKey(), 'Something new')
  expect(await requestCloudBackup('evening-close', Date.now() + BACKUP_MIN_INTERVAL_MS + 1)).toBe(true)
  expect(calls.filter(c => c.method === 'PUT')).toHaveLength(2)
})

// --- restore -----------------------------------------------------------------------

test('a restore is described before anything is replaced, and replaces nothing on its own', async () => {
  const cloud = defaultData()
  cloud.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [
      { id: 'a', title: 'A', done: true },
      { id: 'b', title: 'B', done: false },
    ],
  }
  cloud.days['2026-09-04'] = { date: '2026-09-04', tasks: [{ id: 'c', title: 'C', done: false }] }
  stored.set(STATE_PATH, { sha: 's', content: JSON.stringify(cloud) })
  actions.addTask(todayKey(), 'Mine')

  const preview = await previewRestore()
  expect(preview.cloud).toEqual({ tasks: 3, days: 2, newest: '2026-09-04' })
  expect(preview.here).toEqual({ tasks: 1, days: 1, newest: todayKey() })
  expect(getData().days[todayKey()].tasks[0].title).toBe('Mine')
  expect(preview.data.days['2026-09-04'].tasks[0].title).toBe('C')
})

test('a repo with no backup, or a file that is not a plan, says so rather than replacing with nothing', async () => {
  await expect(previewRestore()).rejects.toThrow(/no backup in that repo/)
  stored.set(STATE_PATH, { sha: 's', content: '{"hello":"world"}' })
  await expect(previewRestore()).rejects.toThrow(/not a Dienius backup/)
  stored.set(STATE_PATH, { sha: 's', content: 'not json' })
  await expect(previewRestore()).rejects.toThrow(/not a Dienius backup/)
})

test('a summary reads the way a person compares two copies', () => {
  expect(describeSummary(summarise(defaultData()))).toBe('empty')
  const data = defaultData()
  data.days['2026-09-04'] = { date: '2026-09-04', tasks: [{ id: 'c', title: 'C', done: false }] }
  expect(describeSummary(summarise(data))).toBe('1 task across 1 day, newest 4 Sept')
})

test('the last backup is said in a person\'s words', () => {
  const now = new Date(2026, 8, 4, 22, 0)
  expect(formatBackupTime(null, now)).toBe('never')
  expect(formatBackupTime(new Date(2026, 8, 4, 21, 40).toISOString(), now)).toBe('today 21:40')
  expect(formatBackupTime(new Date(2026, 8, 3, 8, 12).toISOString(), now)).toBe('yesterday 08:12')
  expect(formatBackupTime(new Date(2026, 8, 1, 21, 40).toISOString(), now)).toBe('Tue 1 Sept 21:40')
})
