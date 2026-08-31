import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
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
