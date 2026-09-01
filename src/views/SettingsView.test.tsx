import { beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from './SettingsView'
import { actions, getData } from '../lib/store'
import { STORAGE_KEY, defaultData, loadData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

test('the theme gallery replaces the old preset-blind toggle - a room can be picked directly in Settings', async () => {
  const user = userEvent.setup()
  render(<SettingsView />)

  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Sketchbook/ }))

  expect(getData().settings.theme.presetId).toBe('sketchbook')
  expect(screen.getByRole('button', { name: /Sketchbook/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Slate/ })).toHaveAttribute('aria-pressed', 'false')
})

test('the mode control keeps working for the active preset, leaving one theme control, not two', async () => {
  const user = userEvent.setup()
  render(<SettingsView />)

  await user.click(screen.getByRole('button', { name: 'Dark' }))
  expect(getData().settings.theme.mode).toBe('dark')
  // Slate and Sketchbook both ship light and dark, so neither is disabled.
  expect(screen.getByRole('button', { name: 'Light' })).not.toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dark' })).not.toBeDisabled()
})

test('importing an invalid file shows an error and leaves existing data untouched', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Keep me')
  const { container } = render(<SettingsView />)

  const file = new File(['not valid json'], 'backup.json', { type: 'application/json' })
  await user.upload(getFileInput(container), file)

  expect(await screen.findByText('That file is not a valid Dienius backup.')).toBeInTheDocument()
  expect(getData().days['2026-09-01'].tasks[0].title).toBe('Keep me')
})

test('importing a valid backup replaces data and clears a previous error', async () => {
  const user = userEvent.setup()
  const { container } = render(<SettingsView />)
  const input = getFileInput(container)

  const badFile = new File(['not valid json'], 'bad.json', { type: 'application/json' })
  await user.upload(input, badFile)
  expect(await screen.findByText('That file is not a valid Dienius backup.')).toBeInTheDocument()

  const backup = {
    templates: [],
    days: {
      '2026-09-05': { date: '2026-09-05', tasks: [{ id: 'imported-1', title: 'Imported task', done: false }] },
    },
    settings: { theme: 'light', enabledWidgets: ['day-plan'] },
  }
  const goodFile = new File([JSON.stringify(backup)], 'good.json', { type: 'application/json' })
  await user.upload(input, goodFile)

  await waitFor(() => {
    expect(getData().days['2026-09-05'].tasks[0].title).toBe('Imported task')
  })
  expect(screen.queryByText('That file is not a valid Dienius backup.')).not.toBeInTheDocument()
})

test('picking the same file twice still triggers an import', async () => {
  const user = userEvent.setup()
  const { container } = render(<SettingsView />)
  const input = getFileInput(container)

  const badFile = new File(['not valid json'], 'backup.json', { type: 'application/json' })
  await user.upload(input, badFile)
  expect(await screen.findByText('That file is not a valid Dienius backup.')).toBeInTheDocument()
  expect(input.value).toBe('')

  await user.upload(input, badFile)
  expect(await screen.findByText('That file is not a valid Dienius backup.')).toBeInTheDocument()
})

function mockReload() {
  const reload = vi.fn()
  const originalLocation = window.location
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload },
  })
  return { reload, restore: () => Object.defineProperty(window, 'location', { configurable: true, value: originalLocation }) }
}

test('erasing all data requires a second confirming tap before it clears storage and reloads', async () => {
  const user = userEvent.setup()
  actions.addTask('2026-09-01', 'Keep me for now')
  const { reload, restore } = mockReload()

  try {
    render(<SettingsView />)
    await user.click(screen.getByRole('button', { name: 'Erase all data' }))
    expect(screen.getByRole('button', { name: 'Confirm reset?' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(reload).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm reset?' }))
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
  } finally {
    restore()
  }
})

test('the reset confirmation resets when focus moves elsewhere, the same as a template delete', async () => {
  const user = userEvent.setup()
  render(<SettingsView />)
  await user.click(screen.getByRole('button', { name: 'Erase all data' }))
  expect(screen.getByRole('button', { name: 'Confirm reset?' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Import backup' }))
  expect(screen.getByRole('button', { name: 'Erase all data' })).toBeInTheDocument()
})

test('confirming the erase clears every part of storage, not just some of it, and a fresh load lands on the default state', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Morning', color: '#f9d48a', blocks: [{ time: '08:00', title: 'Wake up' }] })
  actions.addTask('2026-09-01', 'A real task')
  actions.setTheme('dark')
  const { restore } = mockReload()

  try {
    render(<SettingsView />)
    await user.click(screen.getByRole('button', { name: 'Erase all data' }))
    await user.click(screen.getByRole('button', { name: 'Confirm reset?' }))

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const fresh = loadData()
    expect(fresh).toEqual(defaultData())
  } finally {
    restore()
  }
})

test('export is the primary, single-tap control - the escape route stays easier to reach than the reset', async () => {
  render(<SettingsView />)
  expect(screen.getByRole('button', { name: 'Export backup' })).toHaveClass('primary')
  expect(screen.getByRole('button', { name: 'Erase all data' })).not.toHaveClass('primary')
  expect(screen.getByRole('button', { name: 'Erase all data' })).not.toHaveClass('danger')
})

test('export builds a download and defers revoking the object url', async () => {
  const url = 'blob:mock-url'
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL

  const appendSpy = vi.spyOn(document.body, 'appendChild')
  const removeSpy = vi.spyOn(document.body, 'removeChild')
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  try {
    const user = userEvent.setup()
    render(<SettingsView />)
    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const anchor = appendSpy.mock.calls.map(call => call[0]).find(el => el instanceof HTMLAnchorElement) as HTMLAnchorElement
    expect(anchor.download).toBe('dienius-backup.json')
    expect(anchor.href).toContain(url)
    expect(removeSpy).toHaveBeenCalledWith(anchor)

    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith(url))
  } finally {
    clickSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})

// --- stress test: localStorage full, forced -------------------------------

test('a real forced localStorage failure shows the saving-failed warning, and it clears once storage has room again', async () => {
  const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
  try {
    render(<SettingsView />)
    expect(screen.queryByText(/saving to this browser failed/i)).not.toBeInTheDocument()

    // A commit anywhere in the app - not just something SettingsView itself
    // does - is what actually triggers the failed write this warning
    // reports, so this reaches it the same way a real quota failure would:
    // through an ordinary action, not by poking store internals directly.
    act(() => actions.addTask('2026-09-01', 'Written while storage is full'))
    expect(await screen.findByText(/saving to this browser failed/i)).toBeInTheDocument()

    setItemSpy.mockRestore()
    act(() => actions.addTask('2026-09-01', 'Written once there is room again'))
    await waitFor(() => expect(screen.queryByText(/saving to this browser failed/i)).not.toBeInTheDocument())
  } finally {
    setItemSpy.mockRestore()
  }
})
