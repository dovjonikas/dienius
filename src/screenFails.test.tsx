import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { actions } from './lib/store'
import { defaultData } from './lib/storage'
import { resetTourForTests } from './lib/tourState'
import { resetReplanForTests } from './lib/replanState'

/**
 * A page, a sheet and a panel of the header that cannot draw, in the whole
 * app: each says so in its own place, and everything else goes on working -
 * the rail, the header, and every other page. Until the freeze any one of
 * them took the whole app down to the one boundary in main.tsx.
 *
 * The three are made to throw here by standing in for them; what makes a
 * real one throw is a plan it does not expect, and resilience.test.tsx
 * walks those.
 */

vi.mock('./views/kitchen/KitchenView', () => ({
  KitchenView: () => {
    throw new Error('A recipe with no name')
  },
}))
vi.mock('./views/ShortcutsOverlay', () => ({
  ShortcutsOverlay: () => {
    throw new Error('A shortcut with no key')
  },
}))
vi.mock('./widgets/clock/NotesPanel', () => ({
  NotesPanel: () => {
    throw new Error('A note with no text')
  },
}))

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetTourForTests()
  resetReplanForTests()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('a page that cannot draw says so in its place, and the rail and every other page still work', async () => {
  const user = userEvent.setup()
  const { container } = render(<App />)
  const main = () => container.querySelector('main') as HTMLElement
  // The rail's own buttons: Settings has a Kitchen of its own in its list.
  const go = (page: string) => user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: page }))

  await go('Kitchen')
  expect(within(main()).getByRole('heading', { name: 'Kitchen' })).toBeInTheDocument()
  expect(within(main()).getByRole('alert')).toHaveTextContent('This page could not be shown.')
  expect(within(main()).getByRole('alert')).toHaveTextContent('A recipe with no name')

  for (const page of ['Today', 'Calendar', 'Templates', 'Library', 'Review', 'North', 'Settings']) {
    await go(page)
    expect(within(main()).queryByRole('alert'), page).not.toBeInTheDocument()
  }

  // And back: drawn afresh, and failing the same honest way.
  await go('Kitchen')
  expect(within(main()).getByRole('alert')).toHaveTextContent('This page could not be shown.')
})

test('a sheet that cannot draw is one line over the page, and Close takes it away', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.keyboard('?')
  const line = screen.getByRole('alert')
  expect(line).toHaveTextContent('The shortcuts could not be shown. Nothing is lost.')
  await user.click(within(line).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument()
})

test('a panel of the header that cannot draw is a line inside it, and the header stands', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /^Notes/ }))
  expect(screen.getByRole('alert')).toHaveTextContent('Notes could not be shown. Nothing is lost.')
  expect(screen.getByRole('button', { name: /^Journal/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Calendar' }))
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
})
