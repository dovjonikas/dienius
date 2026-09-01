import { afterEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Task } from '../../lib/types'
import { TimelineGrid } from './TimelineGrid'

function anchor(id: string, time: string, minutes?: number, done = false): Task {
  return { id, title: id, done, time, minutes }
}

function float(id: string, minutes?: number): Task {
  return { id, title: id, done: false, minutes }
}

// `fireEvent.pointerDown(block, ...)` above dispatches a synthetic event
// straight at a known element reference - it proves the handler function
// works, but never proves a real pointer could land on that element in the
// first place. A real pointer resolves through the browser's own
// pointer-events hit-testing before it reaches anything: an element (or an
// aria-hidden ancestor of one) computing `pointer-events: none` is invisible
// to it, and jsdom does not implement `document.elementFromPoint` at all to
// catch that the usual way a live browser check would. What jsdom does
// compute correctly - cascade and inheritance included - is `pointer-events`
// itself, once the real stylesheet is actually loaded into it, which only
// `main.tsx` normally does. Reading `styles.css` straight off disk here,
// rather than a hand-copied fragment of it, means a future edit to the real
// rule is exactly what these tests check against, not a snapshot that could
// quietly drift out of sync with it.
const REAL_STYLESHEET = readFileSync(resolve(__dirname, '../../styles.css'), 'utf-8')

function withRealStylesheet(): () => void {
  const style = document.createElement('style')
  style.textContent = REAL_STYLESHEET
  document.head.appendChild(style)
  return () => style.remove()
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
  const gapButton = screen.getByRole('button', { name: /1h free, 10:00 to 11:00\. tap to fill this time\./i })
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
  expect(screen.getByText(/nothing fits here/i)).toBeInTheDocument()
})

test('a day with no floats at all still opens the gap and says nothing fits, rather than a dead control', async () => {
  const user = userEvent.setup()
  render(<TimelineGrid tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]} />)
  await user.click(screen.getByRole('button', { name: /1h free/i }))
  expect(screen.getByText(/nothing fits here/i)).toBeInTheDocument()
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

// --- real pointer reachability --------------------------------------------
//
// The class of bug the tests above cannot see: a draggable anchor sits
// inside `.timeline-grid`, an aria-hidden decorative layer that carries
// `pointer-events: none` so it never swallows a tap meant for a gap button
// drawn over or beside it (see that class's own comment in styles.css). A
// real pointer resolves that inheritance before it ever reaches the anchor's
// own `onPointerDown` - `fireEvent`/`userEvent` never do, so these three
// checks read the actual cascaded `pointer-events` value instead, against
// the real stylesheet loaded straight off disk (see `withRealStylesheet`
// above).
test('a draggable anchor computes pointer-events auto - a real pointer can reach it despite the aria-hidden layer around it', () => {
  const restore = withRealStylesheet()
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60)]} onAnchorPointerDown={vi.fn()} />,
    )
    const block = container.querySelector('.timeline-anchor-draggable')!
    expect(getComputedStyle(block).pointerEvents).toBe('auto')
  } finally {
    restore()
  }
})

test('a done, non-draggable anchor stays pointer-events none - only a draggable anchor opts back into the decorative layer', () => {
  const restore = withRealStylesheet()
  try {
    const { container } = render(
      <TimelineGrid tasks={[anchor('Shift', '09:00', 60, true)]} onAnchorPointerDown={vi.fn()} />,
    )
    const block = container.querySelector('.timeline-anchor')!
    expect(block).not.toHaveClass('timeline-anchor-draggable')
    expect(getComputedStyle(block).pointerEvents).toBe('none')
  } finally {
    restore()
  }
})

test('the gap layer does not blanket-capture the anchor underneath it - only its own gap buttons stay clickable', () => {
  const restore = withRealStylesheet()
  try {
    const { container } = render(
      <TimelineGrid
        tasks={[anchor('Shift', '09:00', 60), anchor('Gym', '11:00', 30)]}
        onAnchorPointerDown={vi.fn()}
      />,
    )
    const gapsLayer = container.querySelector('.timeline-gaps')!
    const gapButton = gapsLayer.querySelector('.timeline-gap')!
    // .timeline-gaps spans the same full box as the aria-hidden grid beside
    // it (see the shared-coordinate-system comment on .timeline-grid-layers
    // in styles.css) - if it stayed pointer-events: auto across its own
    // empty area, it would sit on top of and swallow every anchor
    // underneath it regardless of the anchor's own pointer-events value,
    // exactly what document.elementFromPoint returned before this fix,
    // confirmed live against the running app.
    expect(getComputedStyle(gapsLayer).pointerEvents).toBe('none')
    // Its own real, focusable buttons opt back in individually - the same
    // pattern .timeline-anchor-draggable uses one layer down.
    expect(getComputedStyle(gapButton).pointerEvents).toBe('auto')
  } finally {
    restore()
  }
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

// --- wide-breakpoint density (fix-fill-viewport-height-report.md) --------
//
// jsdom's own getBoundingClientRect always reports 0 for every element -
// there is no real layout engine underneath it - so useAvailableGridHeight
// always measures `window.innerHeight - 0 - 24` here. That is still enough
// to exercise the actual wiring end to end: a big window.innerHeight really
// does draw a taller grid, a small one really does not draw denser than the
// phone, and isWide=false (every existing caller, and the phone) never
// measures anything regardless of window.innerHeight. Live browser
// verification against a real, positioned grid is in the report.

const ORIGINAL_INNER_HEIGHT = window.innerHeight

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: ORIGINAL_INNER_HEIGHT })
})

function setInnerHeight(value: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value })
}

function layersHeightPx(container: HTMLElement): number {
  const layers = container.querySelector('.timeline-grid-layers') as HTMLElement
  return parseFloat(layers.style.height)
}

test('isWide is false by default: window.innerHeight has no effect on the drawn height, matching the phone', () => {
  const tasks = [anchor('Shift', '09:00', 240), anchor('Gym', '14:30', 60)]
  setInnerHeight(800)
  const short = render(<TimelineGrid tasks={tasks} />)
  const shortHeight = layersHeightPx(short.container)
  short.unmount()

  setInnerHeight(4000)
  const tall = render(<TimelineGrid tasks={tasks} />)
  expect(layersHeightPx(tall.container)).toBe(shortHeight)
})

test('isWide with a generous window.innerHeight draws a genuinely taller grid than the same day at isWide=false', () => {
  const tasks = [anchor('Shift', '09:00', 60)]
  setInnerHeight(3000)
  const narrow = render(<TimelineGrid tasks={tasks} />)
  const narrowHeight = layersHeightPx(narrow.container)

  const wide = render(<TimelineGrid tasks={tasks} isWide />)
  expect(layersHeightPx(wide.container)).toBeGreaterThan(narrowHeight)
})

test('isWide never draws denser than the cap, however large window.innerHeight is', () => {
  const tasks = [anchor('Call', '09:00', 30)]
  setInnerHeight(20000)
  const { container } = render(<TimelineGrid tasks={tasks} isWide />)
  // Anchor-buffered window is 30 (anchor) + 60 + 60 (the one-hour display
  // buffer each side) = 150 minutes, 08:00-10:30. The default wake time
  // (07:00) is within the sleep band's own bridge cap of the buffered
  // start, so displayWindow - what is actually drawn - pulls all the way
  // back to a full 90-minute band, to 05:30, for a total of 300 minutes;
  // the cap is PX_PER_MINUTE * 3 = 3.45px/minute.
  expect(layersHeightPx(container)).toBeLessThanOrEqual(300 * 1.15 * 3 + 1)
})

test('isWide with a small window.innerHeight never draws thinner than isWide=false already does - the base density floors it', () => {
  const tasks = [
    anchor('Commute', '06:30', 30),
    anchor('Wind down', '07:15', 30), // 15-minute gap, under the 38-minute overlap threshold
  ]
  setInnerHeight(0)
  const wide = render(<TimelineGrid tasks={tasks} isWide />)
  const wideHeight = layersHeightPx(wide.container)
  wide.unmount()

  const narrow = render(<TimelineGrid tasks={tasks} />)
  expect(wideHeight).toBe(layersHeightPx(narrow.container))
})

test('a short gap still floors to the 44px touch target at isWide, exactly as it does at any width', () => {
  const tasks = [
    anchor('Commute', '06:30', 30),
    anchor('Wind down', '07:15', 30), // 15-minute gap
  ]
  setInnerHeight(1200)
  const { container } = render(<TimelineGrid tasks={tasks} isWide />)
  const gapButton = container.querySelector('.timeline-gap') as HTMLElement
  expect(parseFloat(gapButton.style.height)).toBeGreaterThanOrEqual(44)
})

// --- the sleep window: greyed band and the accessible boundary sentence ---

test('draws a greyed sleep band inside the aria-hidden decorative layer, not as a focusable element', () => {
  // Default wake time is 07:00; a shift starting at 09:00 buffers to 08:00,
  // within the bridge cap, so a band draws just before the boundary.
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 120)]} />)
  const band = container.querySelector('.timeline-sleep-band')
  expect(band).not.toBeNull()
  expect(band!.closest('[aria-hidden="true"]')).not.toBeNull()
  expect(band!.tagName).toBe('DIV')
})

test('the band carries its own aria-hidden explicitly, not only inherited from an ancestor', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 120)]} />)
  const band = container.querySelector('.timeline-sleep-band')
  expect(band).toHaveAttribute('aria-hidden', 'true')
})

test('the band is drawn a full, legible depth, not a hairline sliver at the boundary', () => {
  // Shift 09:00 for 2h: the default wake time is close enough to bridge, so
  // the band pulls back to a full SLEEP_BAND_MIN_MINUTES (90) deep - well
  // over the compact-label cutoff, and comfortably more than the ~35px a
  // short peek used to draw.
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 120)]} />)
  const band = container.querySelector('.timeline-sleep-band') as HTMLElement
  expect(parseFloat(band.style.height)).toBeCloseTo(90 * 1.15, 5)
})

test('the band names itself with a visible "Sleep" label, so it reads as sleep rather than padding', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Shift', '09:00', 120)]} />)
  const label = container.querySelector('.timeline-sleep-band-label')
  expect(label).not.toBeNull()
  expect(label).toHaveTextContent('Sleep')
  // Aria-hidden by inheritance from the band itself - it is not a second,
  // separate thing a screen reader could encounter after the band.
  expect(label!.closest('[aria-hidden="true"]')).not.toBeNull()
})

test('the band label is omitted once the band is clamped shorter than the compact cutoff', () => {
  // A bedtime pinned at 23:59 with a wake time close enough to bridge to it
  // clamps the resulting band to one minute at the end of the calendar day
  // - nowhere near enough room to letter "Sleep" without spilling out of
  // the shape it is supposed to label.
  const sleep = { sleepWindow: { start: '23:59', end: '07:00' }, nightSleepWindow: { start: '00:00', end: '13:00' } }
  const { container } = render(
    <TimelineGrid tasks={[anchor('Late task', '23:30', 20)]} sleep={sleep} />,
  )
  const band = container.querySelector('.timeline-sleep-band') as HTMLElement
  expect(band).not.toBeNull()
  expect(parseFloat(band.style.height)).toBeLessThan(40)
  expect(band.querySelector('.timeline-sleep-band-label')).toBeNull()
})

test('draws no sleep band when the day is far from the sleep boundary on both sides', () => {
  const { container } = render(<TimelineGrid tasks={[anchor('Lunch', '12:00', 60)]} />)
  expect(container.querySelector('.timeline-sleep-band')).toBeNull()
})

test('a custom sleep window changes where the band draws, not just the historical default', () => {
  // Asleep 20:00 to 10:00 - a custom window whose wake time (10:00) sits
  // just before this task's own buffered start (09:30), so real grey
  // already shows with no forced extension needed.
  const sleep = { sleepWindow: { start: '20:00', end: '10:00' }, nightSleepWindow: { start: '00:00', end: '13:00' } }
  const { container } = render(
    <TimelineGrid tasks={[anchor('Morning task', '10:30', 30)]} sleep={sleep} />,
  )
  const band = container.querySelector('.timeline-sleep-band') as HTMLElement
  expect(band).not.toBeNull()
  expect(parseFloat(band.style.height)).toBeGreaterThan(0)
})

test('a night day measures the sleep band against nightSleepWindow, not the ordinary sleepWindow', () => {
  const sleep = {
    sleepWindow: { start: '23:00', end: '07:00' },
    nightSleepWindow: { start: '10:00', end: '18:00' },
  }
  const { container } = render(
    <TimelineGrid tasks={[anchor('Shift prep', '18:30', 30)]} dayType="night" sleep={sleep} />,
  )
  // Buffered window starts at 17:30, before the 18:00 night wake time, so a
  // real band already shows without any forced extension.
  expect(container.querySelector('.timeline-sleep-band')).not.toBeNull()
})

test('states the sleep window in a visually-hidden sentence, once, regardless of what the visible band shows', () => {
  render(<TimelineGrid tasks={[anchor('Lunch', '12:00', 60)]} />)
  expect(screen.getByText('Asleep from 23:00 to 07:00.')).toHaveClass('visually-hidden')
})

test('the accessible sleep sentence follows a custom sleep window and the night setting', () => {
  const sleep = {
    sleepWindow: { start: '22:00', end: '06:00' },
    nightSleepWindow: { start: '17:00', end: '09:00' },
  }
  render(<TimelineGrid tasks={[anchor('Shift', '10:00', 60)]} dayType="night" sleep={sleep} />)
  expect(screen.getByText('Asleep from 17:00 to 09:00.')).toBeInTheDocument()
})
