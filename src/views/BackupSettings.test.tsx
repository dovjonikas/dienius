import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupSettings } from './BackupSettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { resetCloudBackupForTests, setCloudBackupConfig, toBase64 } from '../lib/cloudBackup'
import { todayKey } from '../lib/dates'

/**
 * The Backup section: two fields, a status in a person's words, and a
 * restore that says what it would replace before the armed second press
 * does it. The API is faked at fetch; lib/cloudBackup.test.ts owns the wire.
 */

let cloud: string | null

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetCloudBackupForTests()
  cloud = null
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit = {}) => {
      const raw = ((init.headers ?? {}) as Record<string, string>).Accept === 'application/vnd.github.raw+json'
      if ((init.method ?? 'GET') === 'GET') {
        if (cloud === null) return Promise.resolve(new Response('{}', { status: 404 }))
        return Promise.resolve(new Response(raw ? cloud : JSON.stringify({ sha: 'x', content: toBase64(cloud) }), { status: 200 }))
      }
      return Promise.resolve(new Response('{"content":{"sha":"y"}}', { status: 200 }))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('with nothing set up the section says so, and Save waits for both fields', async () => {
  render(<BackupSettings />)
  expect(screen.getByRole('status')).toHaveTextContent('Off - add a repo and a token')
  await userEvent.type(screen.getByLabelText('Repo'), 'me/dienius-data')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Token'), 'github_pat_x')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(localStorage.getItem('dienius:cloud-backup')).toContain('me/dienius-data')
  expect(screen.getByRole('status')).toHaveTextContent('Last backup: never.')
  expect(screen.getByRole('button', { name: 'Back up now' })).toBeInTheDocument()
})

test('Back up now writes, and the status says when in words', async () => {
  setCloudBackupConfig({ repo: 'me/dienius-data', token: 'github_pat_x' })
  render(<BackupSettings />)
  await userEvent.click(screen.getByRole('button', { name: 'Back up now' }))
  await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Last backup: today \d\d:\d\d\./))
})

test('restore describes both copies first, replaces only on the armed second press, and can be declined', async () => {
  setCloudBackupConfig({ repo: 'me/dienius-data', token: 'github_pat_x' })
  const copy = defaultData()
  copy.days['2026-08-20'] = {
    date: '2026-08-20',
    tasks: [
      { id: 'a', title: 'From the cloud', done: false },
      { id: 'b', title: 'Also', done: true },
    ],
  }
  cloud = JSON.stringify(copy)
  actions.addTask(todayKey(), 'Mine')

  render(<BackupSettings />)
  await userEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }))
  const preview = await screen.findByRole('group', { name: 'Restore from cloud' })
  expect(preview).toHaveTextContent('Cloud: 2 tasks across 1 day, newest 20 Aug.')
  expect(preview).toHaveTextContent(`Here: 1 task across 1 day, newest`)
  expect(getData().days[todayKey()].tasks[0].title).toBe('Mine')

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('group', { name: 'Restore from cloud' })).toBeNull()
  expect(getData().days[todayKey()].tasks[0].title).toBe('Mine')

  await userEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }))
  await screen.findByRole('group', { name: 'Restore from cloud' })
  await userEvent.click(screen.getByRole('button', { name: 'Replace what is here with the cloud copy' }))
  expect(getData().days[todayKey()].tasks[0].title).toBe('Mine')
  await userEvent.click(screen.getByRole('button', { name: 'Replace?' }))
  expect(getData().days['2026-08-20'].tasks.map(t => t.title)).toEqual(['From the cloud', 'Also'])
  expect(getData().days[todayKey()]).toBeUndefined()
})

test('a repo with no backup yet says so rather than offering to replace with nothing', async () => {
  setCloudBackupConfig({ repo: 'me/dienius-data', token: 'github_pat_x' })
  render(<BackupSettings />)
  await userEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }))
  await screen.findByText('There is no backup in that repo yet.')
  expect(screen.queryByRole('group', { name: 'Restore from cloud' })).toBeNull()
})

/**
 * The confirmation says what a restore would take, not only what it would
 * bring.
 *
 * It counted tasks and days, and a restore replaces everything - so a cloud
 * copy holding an empty week over a device with a library and four goals read
 * as the smaller of the two and said nothing about the books. The owner asked
 * whether the backup keeps North and the library; it always did, and this is
 * the screen that could not prove it.
 */
test('the restore screen counts the library and the goals, and marks what would go', async () => {
  setCloudBackupConfig({ repo: 'me/dienius-data', token: 'github_pat_x' })
  // The cloud copy has a day on it and nothing else.
  const copy = defaultData()
  copy.days['2026-08-20'] = { date: '2026-08-20', tasks: [{ id: 'a', title: 'From the cloud', done: false }] }
  cloud = JSON.stringify(copy)

  // This device has a library and a goal, which the restore would replace.
  const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
  actions.addLibraryItem(list.id, 'Sapiens')
  actions.addLibraryItem(list.id, 'Musashi')
  actions.addGoal({ title: 'Be the dad worth looking up to' }, todayKey())

  render(<BackupSettings />)
  await userEvent.click(screen.getByRole('button', { name: 'Restore from cloud' }))
  await screen.findByRole('group', { name: 'Restore from cloud' })

  const books = screen.getByRole('row', { name: /Library books/ })
  expect(books).toHaveTextContent('2')
  expect(books).toHaveTextContent('fewer')
  const goals = screen.getByRole('row', { name: /Goals/ })
  expect(goals).toHaveTextContent('fewer')
  // And a row that would not lose anything is not marked.
  expect(screen.getByRole('row', { name: /Tasks/ })).not.toHaveTextContent('fewer')
})
