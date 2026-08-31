import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GapPicker } from './GapPicker'
import type { GapOffer } from './gapPlacement'

function option(id: string, minutes?: number) {
  return { id, title: id, minutes }
}

test('announces itself as a labelled dialog', () => {
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free, 13:00 to 14:30" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  const dialog = screen.getByRole('dialog', { name: '1h30 free, 13:00 to 14:30' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
})

test('focus lands on the dialog itself on open', () => {
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByRole('dialog')).toHaveFocus()
})

test('a fitting float shows its duration, tapping it places it', async () => {
  const user = userEvent.setup()
  const onPlace = vi.fn()
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={onPlace} onClose={() => {}} />)
  const row = screen.getByRole('button', { name: /place guitar, 20 min/i })
  expect(row).toHaveTextContent('20 min')
  await user.click(row)
  expect(onPlace).toHaveBeenCalledWith('Guitar')
})

test('an unsized float is offered with a plain "size unknown" label', () => {
  const offer: GapOffer = { fitting: [], unsized: [option('Mystery')] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  const row = screen.getByRole('button', { name: /place mystery, size unknown/i })
  expect(row).toHaveTextContent('size unknown')
})

test('nothing that fits shows a plain message and no list', () => {
  const offer: GapOffer = { fitting: [], unsized: [] }
  render(<GapPicker gapLabel="20 min free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getByText(/nothing in the tray fits here/i)).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

test('more than four options shows only four, with a way to reveal the rest', async () => {
  const user = userEvent.setup()
  const offer: GapOffer = {
    fitting: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => option(id, 10)),
    unsized: [],
  }
  render(<GapPicker gapLabel="lots free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  const more = screen.getByRole('button', { name: /show 2 more/i })
  await user.click(more)
  expect(screen.getAllByRole('listitem')).toHaveLength(6)
  expect(screen.queryByRole('button', { name: /show.*more/i })).not.toBeInTheDocument()
})

test('four or fewer options never shows a "show more" control', () => {
  const offer: GapOffer = { fitting: ['a', 'b', 'c', 'd'].map(id => option(id, 10)), unsized: [] }
  render(<GapPicker gapLabel="lots free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  expect(screen.queryByRole('button', { name: /show.*more/i })).not.toBeInTheDocument()
})

test('the explicit close button calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('pressing Escape calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={onClose} />)
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('tapping the scrim behind the sheet calls onClose', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  const { container } = render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={onClose} />)
  const scrim = container.querySelector('.gap-picker-scrim')!
  await user.click(scrim)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('Tab wraps from the last focusable control back to the first, trapping focus in the sheet', async () => {
  const user = userEvent.setup()
  const offer: GapOffer = { fitting: [option('Guitar', 20)], unsized: [] }
  render(<GapPicker gapLabel="1h30 free" offer={offer} onPlace={() => {}} onClose={() => {}} />)
  const close = screen.getByRole('button', { name: /close/i })
  const row = screen.getByRole('button', { name: /place guitar/i })
  row.focus()
  expect(row).toHaveFocus()
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab()
  expect(row).toHaveFocus()
})
