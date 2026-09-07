import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotesPanel } from './NotesPanel'
import { ClockPopover } from './ClockPopover'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

/**
 * One line, kept, and the panel is gone.
 *
 * It was the clock panel's third tab for one version - these tests rendered
 * `ClockPopover` with `tab="notes"` - which meant reaching a line somebody
 * wanted to write by pressing a picture of a clock and reading four labels
 * to find the one that was not about time. It has its own button now, and
 * its own panel, and this file follows it.
 *
 * Deliberately not a second Scratch: one line, Enter, gone. Anything more is
 * the full stream, and the panel says where that is.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function open(onOpenFull = () => {}, onClose = () => {}) {
  render(<NotesPanel onOpenFull={onOpenFull} onClose={onClose} />)
}

test('one line and Enter keeps the note and closes the panel', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  open(() => {}, onClose)

  const box = screen.getByRole('textbox', { name: 'A quick note' })
  await user.type(box, 'Ada: her sister is called Nel{Enter}')

  expect(getData().scratch.map(n => n.text)).toEqual(['Ada: her sister is called Nel'])
  expect(onClose).toHaveBeenCalled()
})

test('Enter on an empty line does nothing, so a stray keystroke leaves no note', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  open(() => {}, onClose)

  await user.type(screen.getByRole('textbox', { name: 'A quick note' }), '   {Enter}')
  expect(getData().scratch).toEqual([])
  expect(onClose).not.toHaveBeenCalled()
})

test('the last three notes are there to read, newest first, and no more than three', () => {
  for (const text of ['oldest', 'second', 'third', 'newest']) actions.addScratch(text)
  open()

  const shown = screen.getAllByRole('listitem').map(li => li.textContent)
  expect(shown).toHaveLength(3)
  expect(shown[0]).toContain('newest')
  expect(shown).not.toContain('oldest')
})

test('a long note is shortened here rather than filling the panel', () => {
  actions.addScratch('x'.repeat(200))
  open()
  expect(screen.getByRole('listitem').textContent?.length).toBeLessThan(80)
})

test('with nothing written yet the panel says so instead of showing an empty box', () => {
  open()
  expect(screen.getByText('Nothing written down yet.')).toBeInTheDocument()
})

test('Open notes hands over to the full stream', async () => {
  const user = userEvent.setup()
  const onOpenFull = vi.fn()
  open(onOpenFull)

  await user.click(screen.getByRole('button', { name: 'Open notes' }))
  expect(onOpenFull).toHaveBeenCalled()
})

// The cursor is already in the box: the whole point of this door is that a
// thought reaches a line without a second gesture in between.
test('the box has the cursor the moment the panel opens', () => {
  open()
  expect(screen.getByRole('textbox', { name: 'A quick note' })).toHaveFocus()
})

// --- and what the clock kept ---------------------------------------------

test('the clock panel is two tools, and neither of them is a note', () => {
  render(<ClockPopover onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Timer' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Stopwatch' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Journal' })).toBeNull()
})
