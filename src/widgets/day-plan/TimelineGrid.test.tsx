import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Task } from '../../lib/types'
import { TimelineGrid } from './TimelineGrid'

function anchor(id: string, time: string, minutes?: number): Task {
  return { id, title: id, done: false, time, minutes }
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
