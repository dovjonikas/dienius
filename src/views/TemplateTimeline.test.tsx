import { beforeEach, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
