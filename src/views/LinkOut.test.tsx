import { afterEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkOut } from './LinkOut'
import { memoryHandleStore, onDeviceLink } from '../lib/localFile'

/**
 * The door itself. Three things are held here, and all three are the kind
 * that break silently: the new tab, the two rel words that come with it, and
 * the promise that pressing this is not pressing the card under it.
 */

test('it opens in a new tab, and cannot reach back into this one', () => {
  render(<LinkOut link="https://example.com/spanish" title="Spanish" />)
  const link = screen.getByRole('link')
  expect(link).toHaveAttribute('href', 'https://example.com/spanish')
  expect(link).toHaveAttribute('target', '_blank')
  // noopener stops the page it opens reaching back through window.opener;
  // noreferrer stops this app telling somebody's server what the owner is
  // doing at nine on a Tuesday.
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(link.getAttribute('rel')).toContain('noreferrer')
})

test('the address is in the bubble, which the app draws under the control', () => {
  render(<LinkOut link="http://192.168.1.4/spanish/easy" title="Spanish" />)
  // data-tip is the app's one tooltip - see TipLayer, which places it below
  // its host and never on it.
  expect(screen.getByRole('link')).toHaveAttribute('data-tip', '192.168.1.4/spanish/easy')
})

test('the name says where it goes as well as what it is', () => {
  render(<LinkOut link="http://localhost:8080/easy" title="Easy lessons" />)
  expect(screen.getByRole('link', { name: 'Open Easy lessons at localhost:8080/easy in a new tab' })).toBeInTheDocument()
})

test('a machine of your own and the open internet get different icons', () => {
  const { container: own } = render(<LinkOut link="http://localhost:8080" title="Home" />)
  const { container: out } = render(<LinkOut link="https://example.com" title="Away" />)
  expect(own.querySelector('.link-out')).toHaveAttribute('data-link-kind', 'own')
  expect(out.querySelector('.link-out')).toHaveAttribute('data-link-kind', 'external')
  // Two drawings, not one drawing in two colours: the shape is what a person
  // reads at 20px, and colour alone is a fact only some people get.
  expect(own.querySelector('svg')?.innerHTML).not.toBe(out.querySelector('svg')?.innerHTML)
})

/**
 * The rule the owner asked for in one line: the link never changes what
 * pressing the card does. It sits inside rows whose own press opens a task,
 * a book or a day, and a control whose meaning depends on where in it the
 * pointer landed is worse than no control.
 */
test('pressing it does not press the card it is sitting in', async () => {
  const user = userEvent.setup()
  const cardPressed = vi.fn()
  render(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClick={cardPressed} onPointerDown={cardPressed}>
      <LinkOut link="https://example.com" title="Spanish" />
    </div>,
  )
  await user.click(screen.getByRole('link'))
  expect(cardPressed).not.toHaveBeenCalled()
})

// --- a file picked on one computer, and the phone -----------------------------

/**
 * The same file at an address rides inside the link since v2.21 - see
 * OnDeviceFile.also. The door asks the handle store whether this device
 * holds the file, and is the file's door where it does and the address's
 * where it does not, which is what "the book on the phone too" comes to.
 * The store is a Map here; the render is settled before anything is read,
 * because the answer is a promise.
 */
const IN_THE_CLOUD = onDeviceLink({ id: 'deep', name: 'Deep Work.pdf', also: 'https://drive.example.com/f/1' })

afterEach(() => {
  vi.unstubAllGlobals()
})

test('on a device that does not hold the file, the door goes to the address', async () => {
  render(<LinkOut link={IN_THE_CLOUD} title="Deep work" store={memoryHandleStore()} />)
  await act(async () => {})
  const link = screen.getByRole('link', { name: 'Open Deep work at drive.example.com/f/1 in a new tab' })
  expect(link).toHaveAttribute('href', 'https://drive.example.com/f/1')
  expect(link).toHaveAttribute('data-link-kind', 'external')
  expect(screen.queryByRole('button')).toBeNull()
})

test('on the computer that holds the file, the same link is the file', async () => {
  const store = memoryHandleStore()
  await store.put('deep', {
    name: 'Deep Work.pdf',
    kind: 'file',
    getFile: async () => new File(['a pdf, more or less'], 'Deep Work.pdf'),
  } as unknown as FileSystemFileHandle)
  render(<LinkOut link={IN_THE_CLOUD} title="Deep work" store={store} />)
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'Open Deep work, the file Deep Work.pdf, on this computer' })).toBeInTheDocument()
  expect(screen.queryByRole('link')).toBeNull()
})

test('with no address, a file this device does not hold stays the file door, and says so when pressed', async () => {
  const user = userEvent.setup()
  // The door takes a tab before it knows whether it can fill it; jsdom has
  // no tabs, so the taking is a stub that hands back none.
  vi.stubGlobal('open', vi.fn(() => null))
  render(<LinkOut link={onDeviceLink({ id: 'deep', name: 'Deep Work.pdf' })} title="Deep work" store={memoryHandleStore()} />)
  await act(async () => {})
  expect(screen.queryByRole('link')).toBeNull()
  await user.click(screen.getByRole('button', { name: /on this computer$/ }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'This file was picked on another computer. Pick it again here to open it from this one.',
  )
})
