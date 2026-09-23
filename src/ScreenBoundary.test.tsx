import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenBoundary } from './ScreenBoundary'
import * as download from './lib/download'

/**
 * One screen that fails, and only that one - see ScreenBoundary.tsx. What
 * is on the screen in its place is the whole of what a person has to go on,
 * so it is held here word for word where it matters: the name of what
 * failed, that nothing is lost, the error itself, and a way on.
 */

let broken = true
function Page() {
  if (broken) throw new Error('No kind of day named "night"')
  return <p>The page, drawn</p>
}

beforeEach(() => {
  broken = true
  // React reports a caught render error on console.error, and so does the
  // boundary; both are the expected noise of these tests.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('a page that throws says so in its own place: its name, that nothing is lost, and the error in one line', () => {
  render(
    <ScreenBoundary name="Kitchen">
      <Page />
    </ScreenBoundary>,
  )
  expect(screen.getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument()
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('This page could not be shown.')
  expect(alert).toHaveTextContent('Nothing is lost')
  expect(alert).toHaveTextContent('No kind of day named "night"')
})

test('Try again draws the page afresh once what broke it is gone', async () => {
  const user = userEvent.setup()
  render(
    <ScreenBoundary name="Kitchen">
      <Page />
    </ScreenBoundary>,
  )
  broken = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('The page, drawn')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('Export backup on a failed page saves the whole plan as a file', async () => {
  const user = userEvent.setup()
  const save = vi.spyOn(download, 'downloadText').mockImplementation(() => {})
  render(
    <ScreenBoundary name="Kitchen">
      <Page />
    </ScreenBoundary>,
  )
  await user.click(screen.getByRole('button', { name: 'Export backup' }))
  expect(save).toHaveBeenCalledTimes(1)
  expect(save.mock.calls[0][0]).toBe('dienius-backup.json')
  expect(JSON.parse(save.mock.calls[0][1])).toHaveProperty('templates')
})

test('a sheet that throws is one line over the page, with Close', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <ScreenBoundary name="The journal" kind="sheet" onClose={onClose}>
      <Page />
    </ScreenBoundary>,
  )
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('The journal could not be shown. Nothing is lost.')
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('a part of a screen that throws is one line in its place, and the rest of the screen stands', () => {
  render(
    <div>
      <p>The rest of the header</p>
      <ScreenBoundary name="Notes" kind="inline">
        <Page />
      </ScreenBoundary>
    </div>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Notes could not be shown. Nothing is lost.')
  expect(screen.getByText('The rest of the header')).toBeInTheDocument()
})

test('a page that draws is left alone', () => {
  broken = false
  render(
    <ScreenBoundary name="Kitchen">
      <Page />
    </ScreenBoundary>,
  )
  expect(screen.getByText('The page, drawn')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
