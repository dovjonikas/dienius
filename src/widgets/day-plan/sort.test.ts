import { sortTasks } from './sort'
import type { Task } from '../../lib/types'

function task(title: string, time?: string): Task {
  return { id: title, title, time, done: false }
}

test('sorts timed tasks ascending with untimed at the bottom', () => {
  const sorted = sortTasks([task('c'), task('b', '14:00'), task('a', '09:00'), task('d')])
  expect(sorted.map(t => t.title)).toEqual(['a', 'b', 'c', 'd'])
})

test('does not mutate the input', () => {
  const input = [task('b', '14:00'), task('a', '09:00')]
  sortTasks(input)
  expect(input[0].title).toBe('b')
})
