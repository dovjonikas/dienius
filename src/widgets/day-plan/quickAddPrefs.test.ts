import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_DURATION_MINUTES, readLastDuration, rememberDuration } from './quickAddPrefs'

/**
 * How long the next quick-added task is assumed to take, remembered between
 * sessions. The rule: a stored value this cannot read is not rescued into a
 * plausible one - it falls back to the default, because a number written by
 * something other than this pair of functions is a number nothing here knows
 * the meaning of.
 */
describe('the duration quick-add reaches for', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is half an hour on a fresh install', () => {
    expect(readLastDuration()).toBe(DEFAULT_DURATION_MINUTES)
  })

  it('is whatever was last chosen', () => {
    rememberDuration(45)
    expect(readLastDuration()).toBe(45)
  })

  it('survives a value the chips do not offer', () => {
    rememberDuration(125)
    expect(readLastDuration()).toBe(125)
  })

  it('falls back rather than clamping a stored value it cannot read', () => {
    for (const stored of ['banana', '0', '-30', '2000', '30.5', '']) {
      localStorage.setItem('dienius:quick-add-duration', stored)
      expect(readLastDuration()).toBe(DEFAULT_DURATION_MINUTES)
    }
  })

  it('refuses to write a length that is not one', () => {
    rememberDuration(30)
    rememberDuration(0)
    rememberDuration(-5)
    rememberDuration(10.5)
    expect(readLastDuration()).toBe(30)
  })
})
