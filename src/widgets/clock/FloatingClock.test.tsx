import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FloatingClock } from './FloatingClock'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { clockTools, getClockTools } from '../../lib/clockTools'
import { todayKey } from '../../lib/dates'

const DATE = todayKey()

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  clockTools.resetForTests()
})

/**
 * A timer started from a task's step ticks the step when it rings out. The
 * tick lands on the same effect that chimes - the one tab that watched the
 * timer run out - and it sets done rather than toggling it, so a step
 * ticked by hand while the timer ran stays ticked.
 */

function seedStep(): { taskId: string; subtaskId: string } {
  actions.addTask(DATE, 'Morning ritual')
  const taskId = getData().days[DATE].tasks[0].id
  actions.addSubtask(DATE, taskId, 'Meditation 10 min')
  return { taskId, subtaskId: getData().days[DATE].tasks[0].subtasks![0].id }
}

function ranOutFor(step: { taskId: string; subtaskId: string } | null) {
  clockTools.resetForTests({
    timer: {
      startedAt: Date.now() - 11 * 60_000,
      durationMs: 10 * 60_000,
      elapsedBeforeMs: 0,
      paused: false,
      ...(step ? { step: { date: DATE, ...step } } : {}),
    },
    stopwatch: null,
    focus: null,
    corner: 'bottom-right',
  })
}

test('a timer that ran out for a step ticks the step', () => {
  const step = seedStep()
  ranOutFor(step)
  render(<FloatingClock />)
  expect(getData().days[DATE].tasks[0].subtasks![0].done).toBe(true)
  expect(getClockTools().timer?.rungOut).toBe(true)
})

test('the widget says which step the timer is for', () => {
  const step = seedStep()
  clockTools.startTimer(10 * 60_000, { date: DATE, ...step })
  render(<FloatingClock />)
  expect(screen.getByText('Meditation')).toBeInTheDocument()
})

test('a timer with no step ticks nothing', () => {
  seedStep()
  ranOutFor(null)
  render(<FloatingClock />)
  expect(getData().days[DATE].tasks[0].subtasks![0].done).toBe(false)
})

test('a step whose task is gone by the time the timer rings is nothing to tick, and nothing breaks', () => {
  const step = seedStep()
  actions.deleteTask(DATE, step.taskId)
  ranOutFor(step)
  render(<FloatingClock />)
  expect(getClockTools().timer?.rungOut).toBe(true)
})
