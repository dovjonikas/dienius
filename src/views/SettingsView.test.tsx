import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsView } from './SettingsView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function getFileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}

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
