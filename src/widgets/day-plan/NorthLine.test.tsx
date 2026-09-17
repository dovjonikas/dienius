import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthLine } from './NorthLine'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// --- the text's line, since v2.26 ------------------------------------------------------

/**
 * Where North has a text, the day's top is one line of it - a line from
 * under a heading, picked by lib/northLine.ts - and the signature under it,
 * and a press opens North. Where it has nothing for the day, nothing stands
 * there: goals are retired since v2.28, and the goal's name no longer fills
 * the gap. Generic lines only.
 */
const TEXT = [
  'An introduction line.',
  'FIRST HEADING',
  'first plain line',
  'second plain line',
  'WAKING HEADING [morning]',
  'a morning line',
  'LATER HEADING [evening]',
  'an evening line',
  '---',
  'A signature line.',
].join('\n')

/** The device's clock at a local hour on the day of `DATE`. */
function clockAt(hour: number, minute = 0) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 1, hour, minute))
}

afterEach(() => {
  vi.useRealTimers()
})

test("with a text, the day's top is a line from under a heading and the signature under it", () => {
  clockAt(12)
  actions.setPicture(TEXT)
  render(<NorthLine date={DATE} onOpenNorth={() => {}} />)

  const button = screen.getByRole('button')
  expect(['first plain line', 'second plain line']).toContain(button.querySelector('.north-line-words')!.textContent)
  expect(button.querySelector('.north-line-signature')).toHaveTextContent('A signature line.')
  expect(screen.queryByText(/HEADING/)).toBeNull()
  expect(screen.queryByText('An introduction line.')).toBeNull()
  expect(document.body.textContent).not.toMatch(/\[(morning|evening)\]/i)
})

test('a press on the line opens North', async () => {
  clockAt(12)
  const user = userEvent.setup()
  const onOpenNorth = vi.fn()
  actions.setPicture(TEXT)
  render(<NorthLine date={DATE} onOpenNorth={onOpenNorth} />)
  await user.click(screen.getByRole('button'))
  expect(onOpenNorth).toHaveBeenCalledTimes(1)
})

test('the same date shows the same line, and the next date the other one', () => {
  clockAt(12)
  actions.setPicture(TEXT)
  const words = (date: string) => {
    const { container, unmount } = render(<NorthLine date={date} onOpenNorth={() => {}} />)
    const text = container.querySelector('.north-line-words')!.textContent
    unmount()
    return text
  }
  expect(words('2026-09-05')).toBe(words('2026-09-05'))
  expect(words('2026-09-06')).not.toBe(words('2026-09-05'))
})

test("in the three hours after waking today shows the morning's line, and from 21:00 the evening's", () => {
  actions.setPicture(TEXT)
  localStorage.setItem('dienius:north-woke', String(new Date(2026, 8, 1, 7, 0).getTime()))

  clockAt(9, 30)
  const morning = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(morning.container.querySelector('.north-line-words')).toHaveTextContent('a morning line')
  morning.unmount()

  clockAt(10, 30)
  const later = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(['first plain line', 'second plain line']).toContain(later.container.querySelector('.north-line-words')!.textContent)
  later.unmount()

  clockAt(21, 5)
  const evening = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(evening.container.querySelector('.north-line-words')).toHaveTextContent('an evening line')
  evening.unmount()

  // Another day, looked at from this morning, shows its line for the day.
  clockAt(9, 30)
  const tomorrow = render(<NorthLine date="2026-09-02" onOpenNorth={() => {}} />)
  expect(['first plain line', 'second plain line']).toContain(tomorrow.container.querySelector('.north-line-words')!.textContent)
})

test('at an hour whose lines are all under the other tag, the signature stands alone', () => {
  clockAt(12)
  actions.setPicture('WAKING HEADING [morning]\na morning line\n---\nA signature line.')
  const { container } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(container.querySelector('.north-line-words')).toBeNull()
  expect(screen.getByRole('button')).toHaveTextContent('A signature line.')
})

test('no text, a text with nothing for the day, or the switch off the day: nothing stands there', () => {
  clockAt(12)
  const empty = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(empty.container).toBeEmptyDOMElement()
  empty.unmount()

  actions.setPicture('An introduction line, and nothing else.')
  const { container, rerender } = render(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(container).toBeEmptyDOMElement()

  act(() => {
    actions.setPicture(TEXT)
    actions.setNorthSettings({ ...getData().settings.north, stripOnDay: false })
  })
  rerender(<NorthLine date={DATE} onOpenNorth={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
