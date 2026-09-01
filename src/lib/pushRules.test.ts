import { expect, test } from 'vitest'
import { MAX_PUSHES, isPushable } from './pushRules'

test('a task below the bound is pushable', () => {
  expect(isPushable({ pushCount: 0 })).toBe(true)
  expect(isPushable({ pushCount: MAX_PUSHES - 1 })).toBe(true)
})

test('a task with no pushCount at all is treated as freshly unpushed, and pushable', () => {
  expect(isPushable({})).toBe(true)
})

test('a task at or past the bound is not pushable', () => {
  expect(isPushable({ pushCount: MAX_PUSHES })).toBe(false)
  expect(isPushable({ pushCount: MAX_PUSHES + 5 })).toBe(false)
})

test('a task marked unbounded is pushable no matter how many times it has already moved', () => {
  expect(isPushable({ pushCount: MAX_PUSHES, unbounded: true })).toBe(true)
  expect(isPushable({ pushCount: MAX_PUSHES + 50, unbounded: true })).toBe(true)
})

test('unbounded: false behaves exactly like unbounded being absent', () => {
  expect(isPushable({ pushCount: MAX_PUSHES, unbounded: false })).toBe(false)
})
