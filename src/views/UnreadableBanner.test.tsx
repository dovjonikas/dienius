import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnreadableBanner } from './UnreadableBanner'
import { SettingsView } from './SettingsView'
import { actions } from '../lib/store'
import { defaultData, loadData, STORAGE_KEY } from '../lib/storage'
import { resetUnreadableForTests, UNREADABLE_KEY } from '../lib/unreadable'
import * as download from '../lib/download'

/**
 * What a person is told about a plan this browser could not read, and what
 * they can do about it - see lib/unreadable.ts. The line is over every page
 * until they have chosen; the choices are in Settings, beside the export.
 */

beforeEach(() => {
  localStorage.clear()
  resetUnreadableForTests()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  vi.restoreAllMocks()
})

function unreadableOpened(text = '{"templates": [ a byte went wrong'): void {
  localStorage.setItem(STORAGE_KEY, text)
  actions.resetForTests(loadData())
}

test('with nothing kept aside there is no line', () => {
  render(<UnreadableBanner onOpen={() => {}} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('a plan kept aside puts one line over the page, and its button opens what to do', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  unreadableOpened()
  render(<UnreadableBanner onOpen={onOpen} />)
  expect(screen.getByRole('status')).toHaveTextContent('could not be read')
  await user.click(screen.getByRole('button', { name: 'What to do' }))
  expect(onOpen).toHaveBeenCalledTimes(1)
})

test('Settings saves the kept plan as a file, byte for byte', async () => {
  const user = userEvent.setup()
  const save = vi.spyOn(download, 'downloadText').mockImplementation(() => {})
  unreadableOpened()
  render(<SettingsView />)
  await user.click(screen.getByRole('button', { name: 'Save as a file' }))
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][0]).toMatch(/^dienius-unreadable-\d{4}-\d{2}-\d{2}\.json$/)
  expect(save.mock.calls[0][1]).toBe('{"templates": [ a byte went wrong')
})

test('forgetting it takes two presses, and then the row and the line are gone', async () => {
  const user = userEvent.setup()
  unreadableOpened()
  render(
    <>
      <UnreadableBanner onOpen={() => {}} />
      <SettingsView />
    </>,
  )
  await user.click(screen.getByRole('button', { name: 'Forget it' }))
  expect(localStorage.getItem(UNREADABLE_KEY)).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Forget it?' }))
  expect(localStorage.getItem(UNREADABLE_KEY)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save as a file' })).not.toBeInTheDocument()
  expect(screen.queryByText(/could not be read/)).not.toBeInTheDocument()
})

test('with nothing kept aside Settings has no such row', async () => {
  render(<SettingsView />)
  // Settings asks two things on mount that answer in a promise; waited out
  // here the way SettingsView.test.tsx does.
  await act(async () => {})
  expect(screen.queryByRole('button', { name: 'Save as a file' })).not.toBeInTheDocument()
})
