import { expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TimelineGrid } from './TimelineGrid'

function anchor(id: string, time: string, minutes?: number, done = false): Task {
  return { id, title: id, done, time, minutes }
}

function float(id: string, minutes?: number): Task {
  return { id, title: id, done: false, minutes }
}

test('renders nothing at all for a day with no anchors', () => {
  const { container } = render(<TimelineGrid tasks={[float('Guitar', 20)]} />)
  expect(container).toBeEmptyDOMElement()
})

test('the grid itself is aria-hidden and carries no focusable element', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />,
  )
  const grid = container.querySelector('.timeline-grid')
  expect(grid).toHaveAttribute('aria-hidden', 'true')
  expect(grid!.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
})

test('an anchor from a day with a template color renders with that color and the pinned-text class', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} templateColor="#a7c4f5" />,
  )
  const block = container.querySelector('.timeline-anchor')!
  expect(block).toHaveClass('timeline-anchor-colored')
  expect((block as HTMLElement).style.background).toContain('167, 196, 245')
})

test('an anchor on a day with no template falls back to a neutral, uncolored card', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} />)
  const block = container.querySelector('.timeline-anchor')!
  expect(block).not.toHaveClass('timeline-anchor-colored')
  expect((block as HTMLElement).style.background).toBe('')
})

test('an unsized anchor renders with the unsized class and no colored background even with a template color', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Mystery', '09:00')]} templateColor="#a7c4f5" />)
  const block = container.querySelector('.timeline-anchor')!
  expect(block).toHaveClass('timeline-anchor-unsized')
  expect(block).not.toHaveClass('timeline-anchor-colored')
})

test('a note explaining hidden gaps only appears when an anchor is unsized', () => {
  const sized = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />)
  expect(sized.container.querySelector('.timeline-note')).toBeNull()

  const unsized = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Mystery', '11:00')]} />)
  expect(unsized.container.querySelector('.timeline-note')).not.toBeNull()
})

test('a labelled gap renders between two sized anchors with room between them', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />,
  )
  const gap = container.querySelector('.timeline-gap-label')
  expect(gap).toHaveTextContent('1h free')
})

test('a clipped anchor carries the clipped class and states its real wrapped time range', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Night shift', '23:00', 180)]} />)
  const block = container.querySelector('.timeline-anchor')!
  expect(block).toHaveClass('timeline-anchor-clipped')
  expect(block).toHaveTextContent('23:00 - 02:00 (next day)')
})

test('a gap renders as a real, focusable button outside the aria-hidden layer, not a decorative div', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />,
  )
  const gapButton = screen.getByRole('button', { name: /1h free, 10:00 to 11:00\. tap to place a float\./i })
  expect(gapButton.tagName).toBe('BUTTON')
  expect(container.querySelector('.timeline-grid')!.contains(gapButton)).toBe(false)
})

test('tapping a gap opens a picker offering the floats that fit it', async () => {
  const user = userEvent.setup()
  render(
    <TimelineGrid
      tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 20), float('Big errand', 400)]}
    />,
  )
  const gapButton = screen.getByRole('button', { name: /1h free/i })
  await user.click(gapButton)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /place guitar, 20 min/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /place big errand/i })).not.toBeInTheDocument()
  expect(gapButton).toHaveAttribute('aria-expanded', 'true')
})

test('a gap with nothing that fits still opens, and says so plainly instead of showing an empty picker', async () => {
  const user = userEvent.setup()
  render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Big errand', 400)]} />,
  )
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  expect(screen.getByText(/nothing in the tray fits here/i)).toBeInTheDocument()
})

test('a day with no floats at all still opens the gap and says nothing fits, rather than a dead control', async () => {
  const user = userEvent.setup()
  render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />)
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  expect(screen.getByText(/nothing in the tray fits here/i)).toBeInTheDocument()
})

test('placing a float calls onPlaceFloat with the gap\'s own start time and closes the picker', async () => {
  const user = userEvent.setup()
  const onPlaceFloat = vi.fn()
  render(
    <TimelineGrid
      tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 20)]}
      onPlaceFloat={onPlaceFloat}
    />,
  )
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  await user.click(screen.getByRole('button', { name: /place guitar, 20 min/i }))
  expect(onPlaceFloat).toHaveBeenCalledWith('Guitar', '10:00')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('placing announces itself to screen readers via a live region', async () => {
  const user = userEvent.setup()
  render(
    <TimelineGrid
      tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 20)]}
      onPlaceFloat={() => {}}
    />,
  )
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  await user.click(screen.getByRole('button', { name: /place guitar, 20 min/i }))
  expect(screen.getByText('Guitar placed at 10:00.')).toBeInTheDocument()
})

test('closing the picker without placing returns focus to the gap button that opened it', async () => {
  const user = userEvent.setup()
  render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 20)]} />,
  )
  const gapButton = screen.getByRole('button', { name: /1h free/i })
  await user.click(gapButton)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(gapButton).toHaveFocus()
})

test('tapping an open gap again closes its own picker', async () => {
  const user = userEvent.setup()
  render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 20)]} />,
  )
  const gapButton = screen.getByRole('button', { name: /1h free/i })
  await user.click(gapButton)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.click(gapButton)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a day with no anchors renders no gap buttons at all, same as it renders no grid', () => {
  render(<TimelineGrid tasks={[float('Guitar', 20)]} />)
  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

// Step 7's drag: the visual anchor block becomes the pointer-drag source
// for "drag an anchor back to the tray." It stays inside the aria-hidden
// decorative layer - the accessible equivalent is the "remove time"
// button on the task's own list row, unaffected by any of this - so
// wiring a pointer handler onto it adds no new accessibility surface,
// same reasoning as the rest of this layer's own doc comment.
test('a not-done anchor carries the drag handle wiring: touch-action none and the pointerdown callback', () => {
  const onAnchorPointerDown = vi.fn()
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} onAnchorPointerDown={onAnchorPointerDown} />,
  )
  const block = container.querySelector('.timeline-anchor')!
  expect(block).toHaveClass('timeline-anchor-draggable')
  fireEvent.pointerDown(block, { pointerId: 1 })
  expect(onAnchorPointerDown).toHaveBeenCalledWith('Shift', expect.anything())
})

test('a done anchor is never wired for drag - it has no undo control on its row either', () => {
  const onAnchorPointerDown = vi.fn()
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60, true)]} onAnchorPointerDown={onAnchorPointerDown} />,
  )
  const block = container.querySelector('.timeline-anchor')!
  expect(block).not.toHaveClass('timeline-anchor-draggable')
  fireEvent.pointerDown(block, { pointerId: 1 })
  expect(onAnchorPointerDown).not.toHaveBeenCalled()
})

test('with no onAnchorPointerDown supplied, no anchor is ever wired for drag', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} />)
  expect(container.querySelector('.timeline-anchor')).not.toHaveClass('timeline-anchor-draggable')
})

test('the anchor currently being dragged carries a dragging class', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} draggingTaskId="Shift" />,
  )
  expect(container.querySelector('.timeline-anchor')).toHaveClass('timeline-anchor-dragging')
})

test('a float exactly the size of the gap is offered and can be placed', async () => {
  const user = userEvent.setup()
  const onPlaceFloat = vi.fn()
  render(
    <TimelineGrid
      tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30), float('Guitar', 60)]}
      onPlaceFloat={onPlaceFloat}
    />,
  )
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  await user.click(screen.getByRole('button', { name: /place guitar, 1h/i }))
  expect(onPlaceFloat).toHaveBeenCalledWith('Guitar', '10:00')
})

// --- visual rebuild: anchor material -------------------------------------

test('a short sized anchor renders with the compact modifier class once its drawn height falls under the compact cutoff', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Call', '09:00', 5)]} />)
  const block = container.querySelector('.timeline-anchor')!
  expect(block).toHaveClass('timeline-anchor-compact')
})

test('a full-length sized anchor does not carry the compact modifier class', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 240)]} />)
  const block = container.querySelector('.timeline-anchor')!
  expect(block).not.toHaveClass('timeline-anchor-compact')
})

// --- visual rebuild: half-hour rules --------------------------------------

test('half-hour rules render at every half-hour within the window, with no label of their own', () => {
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />,
  )
  const halves = container.querySelectorAll('.timeline-half-hour-rule')
  expect(halves.length).toBeGreaterThan(0)
  halves.forEach(h => expect(h.textContent).toBe(''))
})

// --- visual rebuild: current-time indicator -------------------------------
//
// Each test below owns its own fake-timer lifecycle rather than a shared
// beforeEach/afterEach, so the userEvent-driven tests elsewhere in this
// file (which rely on real timers for their internal delays) are never
// affected by these.

test('draws a current-time indicator when the day is today and the clock falls inside the window', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 31, 9, 30))
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} isToday />,
    )
    expect(container.querySelector('.timeline-now-line')).not.toBeNull()
    expect(container.querySelector('.timeline-now-dot')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('draws no current-time indicator when isToday is not set, even if the clock would fall inside the window', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 31, 9, 30))
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />,
    )
    expect(container.querySelector('.timeline-now-line')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('draws no current-time indicator when the clock falls outside the drawn window', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 31, 20, 0))
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} isToday />,
    )
    expect(container.querySelector('.timeline-now-line')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('the current-time indicator sits inside the aria-hidden decorative layer, never announced as content', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 31, 9, 30))
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} isToday />,
    )
    const line = container.querySelector('.timeline-now-line')!
    expect(line.closest('[aria-hidden="true"]')).not.toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('the current-time indicator moves when a minute-scale interval ticks, and stops updating after unmount', () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date(2026, 7, 31, 9, 30))
    const { container, unmount } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} isToday />,
    )
    const before = (container.querySelector('.timeline-now-line') as HTMLElement).style.top

    act(() => {
      vi.setSystemTime(new Date(2026, 7, 31, 9, 45))
      vi.advanceTimersByTime(60_000)
    })
    const after = (container.querySelector('.timeline-now-line') as HTMLElement).style.top
    expect(after).not.toBe(before)

    unmount()
    expect(() => act(() => vi.advanceTimersByTime(120_000))).not.toThrow()
  } finally {
    vi.useRealTimers()
  }
})
