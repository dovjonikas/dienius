import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncSettings } from './SyncSettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { resetCloudBackupForTests, setCloudBackupConfig, toBase64, fromBase64 } from '../lib/cloudBackup'
import { resetGitHubSyncForTests } from '../lib/githubSync'
import { getSyncStatus, resetSyncForTests, setSyncConfig, syncNow } from '../lib/syncClient'
import type { AppData } from '../lib/types'

/**
 * Settings, Sync - docs/SYNC-AUDIT.md, path 9, and the first connection's
 * question, path 4. What this device last did, whether anything waits to
 * go, whether it is behind, and the one choice the first connection asks
 * for before anything is written. The repo is faked at fetch;
 * lib/syncTwoDevices.test.ts walks the same paths with two devices.
 */

const DATE = '2026-09-22'
let held: AppData | null
let reads: number

function theirPlan(title: string): AppData {
  const plan = defaultData()
  plan.days[DATE] = {
    date: DATE,
    tasks: [{ id: 'theirs-1', title, done: false, updatedAt: '2026-09-22T06:00:00.000Z' }],
    updatedAt: '2026-09-22T06:00:00.000Z',
  } as AppData['days'][string]
  return plan
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetCloudBackupForTests()
  resetSyncForTests()
  resetGitHubSyncForTests()
  held = null
  reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'PUT') {
        const body = JSON.parse(String(init.body)) as { content: string }
        held = JSON.parse(fromBase64(body.content)) as AppData
        return Promise.resolve(
          new Response(JSON.stringify({ content: { sha: 'b' }, commit: { committer: { date: new Date().toISOString() } } }), { status: 201 }),
        )
      }
      reads++
      if (!held) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }))
      return Promise.resolve(new Response(JSON.stringify({ sha: 'a', content: toBase64(JSON.stringify(held)) }), { status: 200 }))
    }),
  )
  setCloudBackupConfig({ repo: 'someone/plans', token: 'test-token' })
})

afterEach(() => {
  resetSyncForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test("this device's last pull and last push, and what waits to go, each on a line of its own", async () => {
  actions.addTask(DATE, 'Book the dentist')
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()
  render(<SyncSettings />)

  const facts = screen.getByRole('group', { name: 'This device' })
  expect(within(facts).getByText('Last pull').nextElementSibling).toHaveTextContent('just now')
  expect(within(facts).getByText('Last push').nextElementSibling).toHaveTextContent('just now')
  expect(within(facts).getByText('Waiting to send').nextElementSibling).toHaveTextContent('Nothing')
  expect(within(facts).getByText('GitHub').nextElementSibling).toHaveTextContent('Nothing newer than here')
})

test('a device whose last pull failed says it is behind, and Pull tries again at once', async () => {
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()
  const fetchMock = vi.mocked(fetch)
  const working = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
  const { pullOnly } = await import('../lib/syncClient')
  await pullOnly()
  render(<SyncSettings />)

  expect(screen.getByText(/This device is behind GitHub/)).toBeInTheDocument()
  expect(screen.getByText(/Cannot reach GitHub/)).toBeInTheDocument()

  fetchMock.mockImplementation(working)
  const before = reads
  await userEvent.click(screen.getByRole('button', { name: 'Pull' }))
  await vi.waitFor(() => expect(reads).toBeGreaterThan(before))
  await vi.waitFor(() => expect(screen.queryByText(/This device is behind GitHub/)).toBeNull())
})

test('the first connection of a device with a plan of its own asks, with both sides described', async () => {
  held = theirPlan('Water the plants')
  actions.addTask(DATE, 'Book the dentist')
  actions.addTask(DATE, 'Renew the passport')
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()
  render(<SyncSettings />)

  const choice = screen.getByRole('group', { name: 'Which plan this device keeps' })
  expect(within(choice).getByText(/GitHub: 1 task/)).toBeInTheDocument()
  expect(within(choice).getByText(/This device: 2 tasks/)).toBeInTheDocument()
  expect(within(choice).getByRole('button', { name: 'Take from GitHub' })).toBeInTheDocument()
  expect(within(choice).getByRole('button', { name: 'Keep this one' })).toBeInTheDocument()
  expect(within(choice).getByRole('button', { name: 'Merge' })).toBeInTheDocument()
})

test('Take from GitHub puts GitHub’s plan here, and the question goes', async () => {
  held = theirPlan('Water the plants')
  actions.addTask(DATE, 'Book the dentist')
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()
  render(<SyncSettings />)

  await userEvent.click(screen.getByRole('button', { name: 'Take from GitHub' }))
  await vi.waitFor(() => expect(getData().days[DATE].tasks.map(t => t.title)).toEqual(['Water the plants']))
  expect(getSyncStatus().choice).toBeNull()
  expect(screen.queryByRole('group', { name: 'Which plan this device keeps' })).toBeNull()
})

// The other device's answer: the one whose plan is the right one keeps it,
// and GitHub's goes - on the other devices too. It deletes what only they
// have, so it asks twice, the way Replace everything does.
test('Keep this one asks for a second press, then puts this plan on GitHub in place of the other', async () => {
  held = theirPlan('Water the plants')
  actions.addTask(DATE, 'Book the dentist')
  setSyncConfig({ url: '', token: '', enabled: true, via: 'github' })
  await syncNow()
  render(<SyncSettings />)

  const choice = screen.getByRole('group', { name: 'Which plan this device keeps' })
  await userEvent.click(within(choice).getByRole('button', { name: 'Keep this one' }))
  expect(held!.days[DATE].tasks.map(t => t.title)).toEqual(['Water the plants'])

  await userEvent.click(within(choice).getByRole('button', { name: 'Keep this one?' }))
  await vi.waitFor(() => expect(held!.days[DATE].tasks.map(t => t.title)).toEqual(['Book the dentist']))
  expect(getData().days[DATE].tasks.map(t => t.title)).toEqual(['Book the dentist'])
  expect(screen.queryByRole('group', { name: 'Which plan this device keeps' })).toBeNull()
})

// Backup and sync share a repo and a token, and backing up on one device did
// not bring the other one in: the owner's report of 2026-09-24.
test('the note under the repo says a backup alone does not join the other device', () => {
  render(<SyncSettings />)
  expect(screen.getByText(/Backup alone does not join/)).toBeInTheDocument()
})

test('with sync off here and another device backing up to the same repo, the section says so in red', async () => {
  localStorage.setItem(
    'dienius:cloud-backup',
    JSON.stringify({ repo: 'someone/plans', token: 'test-token', lastBackupAt: null, othersUnseenAt: '2026-09-22T06:00:00.000Z' }),
  )
  resetCloudBackupForTests()
  render(<SyncSettings />)

  const warning = screen.getByText(/Another device backs up to this repo, and sync is off here/)
  expect(warning.closest('.sync-status-bad')).not.toBeNull()
})
