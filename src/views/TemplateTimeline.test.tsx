import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TemplateTimeline } from './TemplateTimeline'
import { actions } from '../lib/store'
import { defaultData } from '../lib/storage'
import type { TemplateBlock } from '../lib/types'

/**
 * The template drawn as the day it makes.
 *
 * The picture itself is TimelineGrid, which has its own tests; what is
 * worth holding here is the wiring: that the sleep comes from the profile
 * the template carries, that a column of a week draws its own blocks and
 * nobody else's, that a clash is said, and that the line underneath is the
 * day in four numbers.
 */

let n = 0
beforeEach(() => {
  n = 0
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function block(over: Partial<TemplateBlock> = {}): TemplateBlock {
  n += 1
  return { id: `b${n}`, title: `Block ${n}`, ...over }
}

test('the line under it is the day in four numbers, live', () => {
  render(<TemplateTimeline blocks={[block({ time: '09:00', minutes: 120, highlight: true })]} />)
  expect(screen.getByText(/^Timed 2h - Free 14h - Sleep 8h - 1 key$/)).toBeInTheDocument()
})

test("a schedule that sleeps after midnight counts its own sleep, and the evening before it as free", () => {
  actions.resetForTests({
    ...defaultData(),
    settings: {
      ...defaultData().settings,
      sleepProfiles: [
        { id: 'default', name: 'Nights', window: { start: '23:00', end: '07:00' } },
        { id: 'late', name: 'Late', window: { start: '02:00', end: '10:00' } },
      ],
    },
  })
  render(<TemplateTimeline blocks={[block({ time: '12:00', minutes: 120 })]} sleepProfileId="late" />)
  // Awake 10:00 to 02:00 the next night: sixteen hours, less the two-hour block.
  expect(screen.getByText(/^Timed 2h - Free 14h - Sleep 8h - 0 key$/)).toBeInTheDocument()
})

test('a narrow column says the same thing in two', () => {
  render(<TemplateTimeline blocks={[block({ time: '09:00', minutes: 120, highlight: true })]} compact />)
  expect(screen.getByText('2h / 1 key')).toBeInTheDocument()
})

test('a clash is said, and the blocks on it are marked', () => {
  const { container } = render(
    <TemplateTimeline blocks={[block({ time: '09:00', minutes: 60 }), block({ time: '09:30', minutes: 60 })]} />,
  )
  expect(screen.getByText('2 blocks overlap 09:30-10:00')).toBeInTheDocument()
  expect(container.querySelectorAll('.timeline-anchor-clash')).toHaveLength(2)
})

test('a template with nothing clashing says nothing at all', () => {
  const { container } = render(<TemplateTimeline blocks={[block({ time: '09:00', minutes: 60 })]} />)
  expect(container.querySelector('.template-timeline-clash')).toBeNull()
})

test('a column of a week draws its own blocks and nobody else', () => {
  const week = [
    block({ weekday: 1, time: '09:00', minutes: 60, title: 'Monday deep work' }),
    block({ weekday: 3, time: '09:00', minutes: 60, title: 'Wednesday gym' }),
  ]
  const { container } = render(<TemplateTimeline blocks={week} weekday={3} compact />)
  expect(within(container).getByText('Wednesday gym')).toBeInTheDocument()
  expect(within(container).queryByText('Monday deep work')).toBeNull()
})

/**
 * The point of the whole picture: how much day there is, before anything is
 * put in it. A template on a later-waking schedule has fewer free hours and
 * says so without anybody counting.
 */
test('the sleep comes from the profile the template carries, and changing it changes the day', () => {
  const data = defaultData()
  data.settings.sleepProfiles = [
    ...data.settings.sleepProfiles,
    { id: 'long', name: 'Long sleep', window: { start: '22:00', end: '08:00' } },
  ]
  actions.resetForTests(data)

  const blocks = [block({ time: '11:00', minutes: 60 })]
  const { rerender } = render(<TemplateTimeline blocks={blocks} />)
  const before = screen.getByText(/^Timed/).textContent

  rerender(<TemplateTimeline blocks={blocks} sleepProfileId="long" />)
  expect(screen.getByText(/^Timed/).textContent).not.toBe(before)
  expect(screen.getByText(/^Timed/).textContent).toContain('Sleep 10h')
})

/**
 * The picture can be edited by hand since v2.21: a block dragged to another
 * hour, its bottom edge pulled to another length, through the same hook the
 * day view drags with. What is held here is the binding - nothing on the
 * picture can be taken hold of until somebody offers to take the change, and
 * a change comes back as a patch on the block's own id. jsdom has no layout,
 * so the numbers are only as real as the grid's own mapping of pixels to
 * minutes with every box at zero: later is later, longer is longer, and that
 * is what is asserted. The gesture on a real grid is the e2e's.
 */

afterEach(() => {
  // jsdom has no elementFromPoint at all - see DayView.dragDrop.test.tsx.
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint
})

// A drop that finds nothing under the pointer is a drop on the grid, which
// is the only kind of drop there is on a template: there is no tray.
function dropOnNothing() {
  document.elementFromPoint = (() => null) as typeof document.elementFromPoint
}

test('without a way to put a change in, the picture is only a picture', () => {
  const { container } = render(<TemplateTimeline blocks={[block({ time: '09:00', minutes: 60 })]} />)
  expect(container.querySelector('.timeline-anchor')).toBeInTheDocument()
  expect(container.querySelector('.timeline-anchor-draggable')).toBeNull()
  expect(container.querySelector('.timeline-anchor-resize')).toBeNull()
})

test('a block dragged down the picture comes back as a later time on its own id, and is said', () => {
  dropOnNothing()
  const onReshape = vi.fn()
  const { container } = render(
    <TemplateTimeline blocks={[block({ id: 'gym', title: 'Gym', time: '09:00', minutes: 60 })]} onReshape={onReshape} />,
  )
  const anchor = container.querySelector('.timeline-anchor-draggable')!
  fireEvent.pointerDown(anchor, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: 300 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 300 })

  expect(onReshape).toHaveBeenCalledTimes(1)
  const [id, patch] = onReshape.mock.calls[0] as [string, { time?: string; minutes?: number }]
  expect(id).toBe('gym')
  expect(patch.time).toMatch(/^\d\d:\d\d$/)
  expect(patch.time! > '09:00').toBe(true)
  expect(patch.minutes).toBeUndefined()
  expect(screen.getByText(`Gym moved to ${patch.time}.`)).toBeInTheDocument()
})

test('the bottom edge pulled down comes back as a longer length, and nothing else', () => {
  const onReshape = vi.fn()
  const { container } = render(
    <TemplateTimeline blocks={[block({ id: 'gym', title: 'Gym', time: '09:00', minutes: 60 })]} onReshape={onReshape} />,
  )
  const strip = container.querySelector('.timeline-anchor-resize')!
  fireEvent.pointerDown(strip, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 900 })

  expect(onReshape).toHaveBeenCalledTimes(1)
  const [id, patch] = onReshape.mock.calls[0] as [string, { time?: string; minutes?: number }]
  expect(id).toBe('gym')
  expect(patch.time).toBeUndefined()
  expect(patch.minutes).toBeGreaterThan(60)
})

test('a press that never moved changes nothing', () => {
  dropOnNothing()
  const onReshape = vi.fn()
  const { container } = render(<TemplateTimeline blocks={[block({ time: '09:00', minutes: 60 })]} onReshape={onReshape} />)
  const anchor = container.querySelector('.timeline-anchor-draggable')!
  fireEvent.pointerDown(anchor, { pointerId: 1, clientX: 100, clientY: 100 })
  fireEvent.pointerUp(document, { pointerId: 1, clientX: 102, clientY: 103 })
  expect(onReshape).not.toHaveBeenCalled()
})
