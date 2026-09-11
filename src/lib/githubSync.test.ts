import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { canSyncThroughGitHub, readSyncState, SYNC_PATH, SyncConflictError, writeSyncState } from './githubSync'
import { setCloudBackupConfig, toBase64, GitHubError } from './cloudBackup'

/**
 * The repo as a place two devices meet.
 *
 * The owner's question was how the computer and the phone see the same plan
 * without running anything and without pressing much. The app already had
 * sync and it wanted a server; it also already had a private repo it pushes
 * the whole state to. This is that repo used as the meeting place, so the
 * setting-up is one repo and one token per device and nothing else.
 *
 * What is tested here is the transport and nothing else. Deciding what to
 * keep is `syncMerge.ts` and is tested there.
 */

/** @type {{ url: string, init: RequestInit }[]} */
let calls: { url: string; init: RequestInit }[] = []
let file: { sha: string; content: string } | null = null
/** Statuses to answer the next PUTs with, in order; then 200. */
let putAnswers: number[] = []

function respond(url: string, init: RequestInit = {}): Promise<Response> {
  calls.push({ url, init })
  const method = init.method ?? 'GET'
  if (method === 'GET') {
    if (!file) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))
    return Promise.resolve(new Response(JSON.stringify({ sha: file.sha, content: toBase64(file.content) }), { status: 200 }))
  }
  const answer = putAnswers.shift() ?? 200
  if (answer !== 200) return Promise.resolve(new Response('{"message":"conflict"}', { status: answer }))
  const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
  file = { sha: `sha-${calls.length}`, content: atob(body.content) }
  return Promise.resolve(new Response('{}', { status: 200 }))
}

beforeEach(() => {
  localStorage.clear()
  calls = []
  file = null
  putAnswers = []
  vi.stubGlobal('fetch', vi.fn(respond))
  setCloudBackupConfig({ repo: 'someone/dienius-data', token: 'github_pat_secret' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('it uses the repo and token the backup already holds, and nothing of its own', () => {
  expect(canSyncThroughGitHub()).toBe(true)
  setCloudBackupConfig({ repo: '', token: '' })
  expect(canSyncThroughGitHub()).toBe(false)
})

test('a repo with nothing in it yet reads as nothing, not as an error', async () => {
  const read = await readSyncState()
  expect(read).toEqual({ state: null, sha: null })
})

test('what one device writes is what the other reads', async () => {
  await writeSyncState({ days: { '2026-09-16': { date: '2026-09-16', tasks: [] } } }, null)
  const read = await readSyncState()
  expect(read.state).toEqual({ days: { '2026-09-16': { date: '2026-09-16', tasks: [] } } })
  expect(read.sha).not.toBeNull()
})

test('it writes beside the backup rather than over it', () => {
  // data/state.json is the backup's, written a few times a day and meant to
  // be opened and read by a person. This is machinery and writes far more
  // often, so it gets a file of its own in the same repo.
  expect(SYNC_PATH).toBe('data/sync.json')
  expect(SYNC_PATH).not.toBe('data/state.json')
})

test('every read goes to GitHub rather than to the browser cache', async () => {
  file = { sha: 'sha-old', content: '{}' }
  await readSyncState()
  // GitHub sends Cache-Control: private, max-age=60. A sync that merges
  // against a minute-old copy is a sync that undoes the other device.
  expect(calls[0].init.cache).toBe('no-store')
})

test('a write carries the version it was read at', async () => {
  file = { sha: 'sha-old', content: '{}' }
  const read = await readSyncState()
  await writeSyncState({ a: 1 }, read.sha)
  const put = calls.find(c => c.init.method === 'PUT')!
  expect(JSON.parse(String(put.init.body)).sha).toBe('sha-old')
})

test('a write over a version that has moved is refused rather than forced', async () => {
  // The whole reason this is not cloudBackup's writeFile. A backup that loses
  // a race can read the new sha and write again, because what it holds is the
  // whole truth of this device. A sync cannot: what it holds was merged
  // against the file *before* the other device wrote, so writing it again
  // would delete whatever they just did.
  file = { sha: 'sha-old', content: '{}' }
  putAnswers = [409]

  await expect(writeSyncState({ a: 1 }, 'sha-old')).rejects.toBeInstanceOf(SyncConflictError)
  // One PUT, and no second one with a fresher sha.
  expect(calls.filter(c => c.init.method === 'PUT')).toHaveLength(1)
})

test('the other shape of the same race is refused the same way', async () => {
  // 422 is what the Contents API answers when a create is sent for a path
  // that has appeared since, which is this race seen from the other end.
  putAnswers = [422]
  await expect(writeSyncState({ a: 1 }, null)).rejects.toBeInstanceOf(SyncConflictError)
})

test('anything else GitHub says is a GitHub error, not a conflict', async () => {
  putAnswers = [401]
  await expect(writeSyncState({ a: 1 }, null)).rejects.toBeInstanceOf(GitHubError)
})

test('a file holding something that is not a plan is read as nothing at all', async () => {
  // Conservative by the same rule the sync client holds to: the worst
  // outcome of a broken remote is "no sync", never "no data".
  file = { sha: 'sha-old', content: 'not json' }
  const read = await readSyncState()
  expect(read.state).toBeNull()
  expect(read.sha).toBe('sha-old')
})
