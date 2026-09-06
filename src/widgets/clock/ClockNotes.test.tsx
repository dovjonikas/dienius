import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClockPopover } from './ClockPopover'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

/**
 * Notes beside the timer and the stopwatch.
 *
 * The clock button is the one control that is on screen from every tab, so
 * it is where a thought goes when there is no time to go anywhere. This is
 * deliberately not a second Scratch: one line, Enter, gone. Anything more
 * than that is the full stream, and the panel says where that is.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function open(onOpenNotes = () => {}) {
  render(<ClockPopover onClose={() => {}} onOpenNotes={onOpenNotes} tab="notes" />)
}

test('one line and Enter keeps the note and closes the panel', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<ClockPopover onClose={onClose} onOpenNotes={() => {}} tab="notes" />)

  const box = screen.getByRole('textbox', { name: 'A quick note' })
  await user.type(box, 'Ada: her sister is called Nel{Enter}')

  expect(getData().scratch.map(n => n.text)).toEqual(['Ada: her sister is called Nel'])
  expect(onClose).toHaveBeenCalled()
})

test('Enter on an empty line does nothing, so a stray keystroke leaves no note', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<ClockPopover onClose={onClose} onOpenNotes={() => {}} tab="notes" />)

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

test('Open notes hands over to the full stream, and closes the panel behind it', async () => {
  const user = userEvent.setup()
  const onOpenNotes = vi.fn()
  const onClose = vi.fn()
  render(<ClockPopover onClose={onClose} onOpenNotes={onOpenNotes} tab="notes" />)

  await user.click(screen.getByRole('button', { name: 'Open notes' }))
  expect(onOpenNotes).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

test('the panel still opens on the timer when nothing asked for notes', () => {
  render(<ClockPopover onClose={() => {}} onOpenNotes={() => {}} />)
  expect(screen.getByRole('button', { name: 'Timer' })).toHaveAttribute('aria-pressed', 'true')
})
