import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AppData } from './types'

/**
 * Two devices and one repo, through every path in docs/SYNC-AUDIT.md by
 * which an older copy could be written over a newer one.
 *
 * Each device is its own storage, and opening one is a fresh load of the
 * app's modules over that storage - the way a page load is. So a reload, a
 * phone picked up after a night, and two devices that share nothing but
 * the repo are all real here, not imitated. The repo is GitHub's Contents
 * API in memory, with its lock: a write carries the sha it read, and a
 * stale one is refused, the way GitHub refuses it.
 *
 * Every test here was written before the fix it holds, and failed.
 */

type Mods = {
  store: typeof import('./store')
  sync: typeof import('./syncClient')
  backup: typeof import('./cloudBackup')
}

interface Device {
  name: string
  storage: Map<string, string>
}

const DAY = '2026-09-22'
const REPO = 'someone/plans'
const SYNC = 'data/sync.json'
const BACKUP = 'data/state.json'

// --- the repo ------------------------------------------------------------------

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function decode(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function fakeRepo() {
  const files = new Map<string, { sha: string; text: string }>()
  const writes: { path: string; message: string }[] = []
  let version = 0
  let online = true
  let beforeNextPut: (() => void) | null = null
  /** Past this many characters the ordinary JSON form refuses the file, as GitHub does past a megabyte. */
  let largeFrom = Infinity

  function put(path: string, text: string, message: string): string {
    const sha = `v${++version}`
    files.set(path, { sha, text })
    writes.push({ path, message })
    return sha
  }

  async function fetchImpl(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    if (!online) throw new TypeError('Failed to fetch')
    const url = String(input)
    const path = decodeURIComponent(url.replace(/^.*\/contents\//, '').replace(/\?.*$/, ''))
    const method = init.method ?? 'GET'
    if (method === 'GET') {
      const file = files.get(path)
      if (!file) return json(404, { message: 'Not Found' })
      const accept = (init.headers as Record<string, string> | undefined)?.Accept ?? ''
      if (accept.includes('raw')) return new Response(file.text, { status: 200 })
      const large = file.text.length > largeFrom
      if (accept.includes('object')) {
        return json(200, { sha: file.sha, size: file.text.length, encoding: large ? 'none' : 'base64', content: large ? '' : encode(file.text) })
      }
      if (large) return json(403, { message: 'This API returns blobs up to 1 MB in size.', errors: [{ code: 'too_large' }] })
      return json(200, { sha: file.sha, content: encode(file.text) })
    }
    if (method === 'PUT') {
      const hook = beforeNextPut
      beforeNextPut = null
      hook?.()
      const body = JSON.parse(String(init.body)) as { message: string; content: string; sha?: string }
      const file = files.get(path)
      // The Contents API's lock: an update names the version it read.
      if (file && !body.sha) return json(422, { message: 'sha was not supplied' })
      if (file && body.sha !== file.sha) return json(409, { message: 'does not match' })
      if (!file && body.sha) return json(422, { message: 'no such file' })
      const sha = put(path, decode(body.content), body.message)
      return json(201, { content: { sha }, commit: { sha: `c-${sha}`, committer: { date: new Date().toISOString() } } })
    }
    return json(405, {})
  }

  return {
    fetchImpl,
    writes,
    setOnline(value: boolean) {
      online = value
    },
    /** What a file holds, parsed, or null when there is none. */
    plan(path = SYNC): AppData | null {
      const file = files.get(path)
      return file ? (JSON.parse(file.text) as AppData) : null
    },
    /** Something else writes the file between this device's read and its write. */
    interleave(fn: () => void) {
      beforeNextPut = fn
    },
    /** Files past this many characters are too large for the ordinary form. */
    tooLargeFrom(chars: number) {
      largeFrom = chars
    },
    /** A write from outside this device, straight to the file. */
    write(path: string, data: AppData) {
      put(path, JSON.stringify(data), 'another device')
    },
  }
}

// --- the devices -------------------------------------------------------------------

let repo: ReturnType<typeof fakeRepo>
let open: { device: Device; mods: Mods } | null = null

function storageNow(): Map<string, string> {
  const out = new Map<string, string>()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null) out.set(key, localStorage.getItem(key) ?? '')
  }
  return out
}

/** Closes whichever device is open: its storage is kept, its memory is not. */
function close(): void {
  if (!open) return
  open.mods.sync.resetSyncForTests()
  open.mods.backup.resetCloudBackupForTests()
  open.device.storage = storageNow()
  open = null
}

/** Opens the app on a device: its storage, and every module loaded afresh. */
async function openOn(device: Device): Promise<Mods> {
  close()
  localStorage.clear()
  for (const [key, value] of device.storage) localStorage.setItem(key, value)
  vi.resetModules()
  const mods: Mods = {
    store: await import('./store'),
    sync: await import('./syncClient'),
    backup: await import('./cloudBackup'),
  }
  open = { device, mods }
  return mods
}

/** A device with the backup's repo and token in it, the way both of the owner's are. */
function device(name: string): Device {
  const storage = new Map<string, string>()
  storage.set('dienius:cloud-backup', JSON.stringify({ repo: REPO, token: 'test-token', lastBackupAt: null }))
  return { name, storage }
}

/** Settings, Sync, "Your GitHub repo", Turn on - and the round trip it starts. */
async function turnOnSync(m: Mods): Promise<void> {
  m.sync.setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await m.sync.syncNow()
  await settle()
}

/** What main.tsx does on a page load, and the round trip it starts. */
async function startApp(m: Mods): Promise<void> {
  m.sync.startSync()
  await m.sync.syncNow()
  await settle()
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0))
}

function later(minutes: number): void {
  vi.setSystemTime(Date.now() + minutes * 60_000)
}

function titlesOn(data: AppData | null | undefined, date = DAY): string[] {
  return (data?.days[date]?.tasks ?? []).map(t => t.title).sort()
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-22T07:00:00.000Z'))
  repo = fakeRepo()
  vi.stubGlobal('fetch', vi.fn(repo.fetchImpl))
})

afterEach(() => {
  close()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- 1. The repo route, after a reload --------------------------------------------

test('a device syncing through the repo is still syncing through it after a reload', async () => {
  const desk = device('desk')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist'])

  later(10)
  m = await openOn(desk)
  expect(m.sync.getSyncConfig().via).toBe('github')
  await startApp(m)
  m.store.actions.addTask(DAY, 'Water the plants')
  await m.sync.syncNow()
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist', 'Water the plants'])
})

// --- 2. The backup's snapshot ---------------------------------------------------

test('a backup from a device that is behind does not put its older copy over the newer one', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await m.backup.requestCloudBackup('manual')

  later(60)
  m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  await m.backup.requestCloudBackup('manual')

  expect(titlesOn(repo.plan(BACKUP))).toEqual(['Book the dentist', 'Water the plants'])
  expect(titlesOn(repo.plan(`data/history/${DAY}.json`))).toEqual(['Book the dentist', 'Water the plants'])
  // And a backup is never a sync: this device's own plan is as it was.
  expect(titlesOn(m.store.getData())).toEqual(['Water the plants'])
})

test('a backup that loses the race to another write reads again and merges, rather than writing over it', async () => {
  const desk = device('desk')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await m.backup.requestCloudBackup('manual')

  // Between this device's read and its write, another one writes the file.
  const theirs = JSON.parse(JSON.stringify(repo.plan(BACKUP))) as AppData
  theirs.days[DAY].tasks.push({ id: 'other-1', title: 'Water the plants', done: false, updatedAt: '2026-09-22T07:30:00.000Z' })
  later(60)
  m.store.actions.addTask(DAY, 'Renew the passport')
  repo.interleave(() => repo.write(BACKUP, theirs))
  await m.backup.requestCloudBackup('manual')

  expect(titlesOn(repo.plan(BACKUP))).toEqual(['Book the dentist', 'Renew the passport', 'Water the plants'])
})

// --- 3. Two devices backing up, sync off --------------------------------------------

test('two devices backing up with sync off are told that they are not seeing each other', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await m.backup.requestCloudBackup('manual')
  expect(m.backup.getCloudBackupStatus().othersUnseenAt ?? null).toBeNull()

  later(60)
  m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  await m.backup.requestCloudBackup('manual')
  expect(m.backup.getCloudBackupStatus().othersUnseenAt).toEqual(expect.any(String))

  // And it is still known after the phone is opened again.
  m = await openOn(phone)
  expect(m.backup.getCloudBackupStatus().othersUnseenAt).toEqual(expect.any(String))
})

// --- 4. The first connection ----------------------------------------------------

test('a device with nothing of its own takes the plan on GitHub whole, its settings too', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  m.store.actions.setTextScale('l')
  await turnOnSync(m)

  // The phone is new. The one thing done on it is a text size, an hour
  // after the desktop chose its own - a newer stamp on an older wish.
  later(60)
  m = await openOn(phone)
  m.store.actions.setTextScale('s')
  await turnOnSync(m)

  expect(m.store.getData().settings.textScale).toBe('l')
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist'])
  expect(repo.plan()!.settings.textScale).toBe('l')
})

test('a device with a plan of its own is asked before anything is written, and nothing is', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)

  later(60)
  m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  const writes = repo.writes.length
  await turnOnSync(m)

  expect(repo.writes.length).toBe(writes)
  expect(titlesOn(m.store.getData())).toEqual(['Water the plants'])
  const choice = m.sync.getSyncStatus().choice
  expect(choice?.here).toMatchObject({ tasks: 1 })
  expect(choice?.remote).toMatchObject({ tasks: 1 })
  expect(choice?.remote.changedAt).toEqual(expect.any(String))
})

test('taking from GitHub replaces the plan here and writes nothing', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)

  later(60)
  m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  await turnOnSync(m)
  const writes = repo.writes.length
  await m.sync.chooseFirstSync('take')
  await settle()

  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist'])
  expect(repo.writes.length).toBe(writes)
  expect(m.sync.getSyncStatus().choice).toBeNull()

  // And from here it is an ordinary device: its next change goes up.
  m.store.actions.addTask(DAY, 'Renew the passport')
  await m.sync.syncNow()
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist', 'Renew the passport'])
})

test('merging keeps both plans, and both devices end up with both', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)

  later(60)
  m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  await turnOnSync(m)
  await m.sync.chooseFirstSync('merge')
  await settle()
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Water the plants'])

  later(5)
  m = await openOn(desk)
  await startApp(m)
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Water the plants'])
})

// The owner's report of 2026-09-24: sync turned on again on the phone did not
// put the computer's plan there - it joined the two. A device that had
// joined once never asked again, so whatever it held after a spell with sync
// off went into the shared plan without a word.
test('a device that turns sync on again is asked again, and taking puts the shared plan there', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)

  later(60)
  m = await openOn(phone)
  await turnOnSync(m)
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist'])
  m.sync.setSyncConfig({ url: '', token: '', enabled: false, via: 'github' })
  m.store.actions.addTask(DAY, 'Water the plants')

  later(10)
  m = await openOn(desk)
  await startApp(m)
  m.store.actions.addTask(DAY, 'Renew the passport')
  await m.sync.syncNow()

  later(10)
  m = await openOn(phone)
  const writes = repo.writes.length
  await turnOnSync(m)
  expect(m.sync.getSyncStatus().choice).not.toBeNull()
  expect(repo.writes.length).toBe(writes)

  await m.sync.chooseFirstSync('take')
  await settle()
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Renew the passport'])
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist', 'Renew the passport'])
})

// The other half: the device whose plan is the right one, when the shared
// copy already holds another - an older one, or the phone's, there first.
// Take would lose this plan and Merge would keep the other; Keep this one
// puts this one in place of it, on the other device too.
test('the device whose plan is the right one keeps it, and the other device follows', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Water the plants')
  await turnOnSync(m)
  expect(titlesOn(repo.plan())).toEqual(['Water the plants'])

  later(60)
  m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)
  expect(m.sync.getSyncStatus().choice).not.toBeNull()

  await m.sync.chooseFirstSync('keep')
  await settle()
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist'])
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist'])

  later(5)
  m = await openOn(phone)
  await startApp(m)
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist'])
})

// --- 5. Two clocks ------------------------------------------------------------------

test('a change made after seeing the other device wins, even on a clock that is behind', async () => {
  const desk = device('desk')
  const phone = device('phone')
  vi.setSystemTime(new Date('2026-09-22T10:00:00.000Z'))
  let m = await openOn(phone)
  m.store.actions.addTask(DAY, 'Pick up the parcel')
  await turnOnSync(m)

  // The desktop's clock is five minutes slow: a minute later it reads 09:56.
  vi.setSystemTime(new Date('2026-09-22T09:56:00.000Z'))
  m = await openOn(desk)
  await turnOnSync(m)
  const id = m.store.getData().days[DAY].tasks[0].id

  // A minute after that, having seen the phone's task, it renames it.
  vi.setSystemTime(new Date('2026-09-22T09:57:00.000Z'))
  m.store.actions.setTaskTitle(DAY, id, 'Pick up the parcel at the post office')
  await m.sync.syncNow()

  expect(titlesOn(m.store.getData())).toEqual(['Pick up the parcel at the post office'])
  expect(titlesOn(repo.plan())).toEqual(['Pick up the parcel at the post office'])
})

// --- 6. Restore from cloud ----------------------------------------------------------

test('bringing back from the backup what is missing leaves what is newer on the other device alone', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await m.backup.requestCloudBackup('manual')
  await turnOnSync(m)

  later(5)
  m = await openOn(phone)
  await turnOnSync(m)

  // The desktop goes on after the backup: a new task, and the old one done.
  later(60)
  m = await openOn(desk)
  await startApp(m)
  const dentist = m.store.getData().days[DAY].tasks[0].id
  m.store.actions.toggleTask(DAY, dentist)
  m.store.actions.addTask(DAY, 'Renew the passport')
  await m.sync.syncNow()

  // On the phone, Restore from cloud, and the press it offers first.
  later(5)
  m = await openOn(phone)
  await startApp(m)
  const preview = await m.backup.previewRestore()
  m.store.actions.mergeBackup(preview.data)
  await m.sync.syncNow()

  later(5)
  m = await openOn(desk)
  await startApp(m)
  const tasks = m.store.getData().days[DAY].tasks
  expect(tasks.map(t => t.title).sort()).toEqual(['Book the dentist', 'Renew the passport'])
  expect(tasks.find(t => t.id === dentist)?.done).toBe(true)
})

// --- 7. The tab closed before the push -------------------------------------------

test('a change made just before the tab closes reaches the other device', async () => {
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  m.store.actions.addTask(DAY, 'Book the dentist')
  await turnOnSync(m)

  later(5)
  m = await openOn(phone)
  await turnOnSync(m)
  m.store.actions.addTask(DAY, 'Buy stamps')
  // The tab goes, and whatever it sends as it goes goes nowhere.
  repo.setOnline(false)
  window.dispatchEvent(new Event('pagehide'))
  await settle()
  repo.setOnline(true)

  // Picked up again later: what it owed goes up as it opens.
  later(30)
  m = await openOn(phone)
  await startApp(m)
  expect(titlesOn(repo.plan())).toEqual(['Book the dentist', 'Buy stamps'])

  later(5)
  m = await openOn(desk)
  await startApp(m)
  expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Buy stamps'])
})

// --- 8. A day opened before the first pull --------------------------------------------

test('opening a day before the first pull has come back does not stamp a second copy of it', async () => {
  const desk = device('desk')
  const phone = device('phone')
  const { weekdayOf } = await import('./repeats')
  let m = await openOn(desk)
  m.store.actions.addTemplate({
    name: 'Work day',
    color: '#8ab6f9',
    blocks: [
      { time: '09:00', title: 'Standup', minutes: 15 },
      { time: '12:00', title: 'Lunch', minutes: 30 },
    ],
  })
  m.store.actions.setWeekdayTemplate(weekdayOf(DAY), m.store.getData().templates[0].id)
  await turnOnSync(m)

  later(5)
  m = await openOn(phone)
  await turnOnSync(m)

  // The desktop opens the day first, and ticks the first block. Its sync is
  // switched on again by hand on each open here, so that this test holds
  // the day's race alone and not the reload's - see the first test.
  later(60)
  m = await openOn(desk)
  await turnOnSync(m)
  m.store.actions.ensureDay(DAY)
  const standup = m.store.getData().days[DAY].tasks.find(t => t.title === 'Standup')!
  m.store.actions.toggleTask(DAY, standup.id)
  await m.sync.syncNow()

  // The phone is picked up: the page loads, and the day view opens the day
  // at once, while the first pull is still in the air.
  later(30)
  m = await openOn(phone)
  m.sync.setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  m.sync.startSync()
  m.store.actions.ensureDay(DAY)
  await m.sync.syncNow()
  await settle()
  await m.sync.syncNow()
  await settle()

  const tasks = m.store.getData().days[DAY].tasks
  expect(tasks.map(t => t.title).sort()).toEqual(['Lunch', 'Standup'])
  expect(tasks.find(t => t.title === 'Standup')?.done).toBe(true)
  expect(titlesOn(repo.plan())).toEqual(['Lunch', 'Standup'])
})

// --- 10. A plan past a megabyte ----------------------------------------------------

test('a plan past a megabyte still syncs and still backs up', async () => {
  // A megabyte is a few months of blocks; here it is a couple of kilobytes.
  repo.tooLargeFrom(2000)
  const desk = device('desk')
  const phone = device('phone')
  let m = await openOn(desk)
  for (let i = 0; i < 12; i++) m.store.actions.addTask(DAY, `Errand number ${i + 1}, with a long enough name`)
  await turnOnSync(m)
  await m.backup.requestCloudBackup('manual')
  expect(titlesOn(repo.plan())).toHaveLength(12)

  later(5)
  m = await openOn(phone)
  await turnOnSync(m)
  expect(m.sync.getSyncStatus().phase).toBe('idle')
  expect(titlesOn(m.store.getData())).toHaveLength(12)
  m.store.actions.addTask(DAY, 'Water the plants')
  await m.sync.syncNow()
  await m.backup.requestCloudBackup('manual')
  expect(m.backup.getCloudBackupStatus().phase).toBe('idle')
  expect(titlesOn(repo.plan())).toHaveLength(13)
  expect(titlesOn(repo.plan(BACKUP))).toHaveLength(13)
})

// --- 11. On the real clock ------------------------------------------------------------

/**
 * The same rules with the clock left alone - the overnight brief of
 * 2026-09-23, stage 4: stamps written by the devices themselves, a few
 * milliseconds apart, and the later change winning on both, in both
 * directions; and a backup brought back after a sync touching nothing the
 * sync made newer.
 */
describe('on the real clock', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  test('a change made later on either device wins on both', async () => {
    const desk = device('desk')
    const phone = device('phone')
    let m = await openOn(desk)
    m.store.actions.addTask(DAY, 'Book the dentist')
    await turnOnSync(m)

    m = await openOn(phone)
    await turnOnSync(m)
    const id = m.store.getData().days[DAY].tasks[0].id
    await pause(5)
    m.store.actions.setTaskTitle(DAY, id, 'Book the dentist for Monday')
    await m.sync.syncNow()

    m = await openOn(desk)
    await startApp(m)
    expect(titlesOn(m.store.getData())).toEqual(['Book the dentist for Monday'])
    await pause(5)
    m.store.actions.setTaskTitle(DAY, id, 'Book the dentist for Tuesday')
    await m.sync.syncNow()

    m = await openOn(phone)
    await startApp(m)
    expect(titlesOn(m.store.getData())).toEqual(['Book the dentist for Tuesday'])
    expect(titlesOn(repo.plan())).toEqual(['Book the dentist for Tuesday'])
  })

  test('two devices changing the same day apart both keep their own change, and neither loses the other', async () => {
    const desk = device('desk')
    const phone = device('phone')
    let m = await openOn(desk)
    m.store.actions.addTask(DAY, 'Book the dentist')
    await turnOnSync(m)
    m = await openOn(phone)
    await turnOnSync(m)

    // Apart: the desktop ticks, the phone adds, neither having seen the other.
    m = await openOn(desk)
    await startApp(m)
    m.store.actions.toggleTask(DAY, m.store.getData().days[DAY].tasks[0].id)
    await pause(5)
    const deskCopy = desk
    m = await openOn(phone)
    m.store.actions.addTask(DAY, 'Water the plants')
    await startApp(m)
    m = await openOn(deskCopy)
    await startApp(m)

    expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Water the plants'])
    expect(m.store.getData().days[DAY].tasks.find(t => t.title === 'Book the dentist')?.done).toBe(true)
    m = await openOn(phone)
    await startApp(m)
    expect(titlesOn(m.store.getData())).toEqual(['Book the dentist', 'Water the plants'])
    expect(m.store.getData().days[DAY].tasks.find(t => t.title === 'Book the dentist')?.done).toBe(true)
  })

  test('a backup brought back after a sync changes nothing the sync made newer', async () => {
    const desk = device('desk')
    const phone = device('phone')
    let m = await openOn(desk)
    m.store.actions.addTask(DAY, 'Book the dentist')
    await turnOnSync(m)
    await m.backup.requestCloudBackup('manual')

    // After the backup: the task renamed and ticked, and synced.
    await pause(5)
    const id = m.store.getData().days[DAY].tasks[0].id
    m.store.actions.setTaskTitle(DAY, id, 'Book the dentist for Monday')
    m.store.actions.toggleTask(DAY, id)
    await m.sync.syncNow()

    // The phone joins, and brings the backup back on top of what it took.
    m = await openOn(phone)
    await turnOnSync(m)
    const preview = await m.backup.previewRestore()
    m.store.actions.mergeBackup(preview.data)
    await m.sync.syncNow()

    for (const d of [phone, desk]) {
      m = await openOn(d)
      await startApp(m)
      const task = m.store.getData().days[DAY].tasks.find(t => t.id === id)
      expect(task, d.name).toMatchObject({ title: 'Book the dentist for Monday', done: true })
      expect(titlesOn(m.store.getData())).toEqual(['Book the dentist for Monday'])
    }
  })
})
