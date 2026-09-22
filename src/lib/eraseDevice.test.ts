import { beforeEach, expect, test } from 'vitest'
import { eraseThisDevice } from './eraseDevice'

/**
 * "Erase all data" - the owner's report of 2026-09-22: erased on the
 * computer, and the day was back a second later. Sync was still switched on,
 * with its token, so the plan walked straight back in from GitHub.
 */

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('an erase takes every key this app wrote on this device, and nothing else', () => {
  localStorage.setItem('dienius:data', '{"days":{}}')
  localStorage.setItem('dienius:sync', '{"enabled":true,"via":"github"}')
  localStorage.setItem('dienius:sync-device', '{"joinedAt":"2026-09-22T06:00:00.000Z"}')
  localStorage.setItem('dienius:cloud-backup', '{"repo":"someone/plans","token":"a token"}')
  localStorage.setItem('dienius:clock-tools', '{}')
  localStorage.setItem('somebody-elses-app', 'kept')
  sessionStorage.setItem('dienius:tour', 'running')
  sessionStorage.setItem('theirs', 'kept')

  eraseThisDevice()

  const left = []
  for (let i = 0; i < localStorage.length; i++) left.push(localStorage.key(i))
  expect(left).toEqual(['somebody-elses-app'])
  expect(sessionStorage.getItem('dienius:tour')).toBeNull()
  expect(sessionStorage.getItem('theirs')).toBe('kept')
})

test('the token and the sync switch go with it, so nothing pulls the plan back', () => {
  localStorage.setItem('dienius:cloud-backup', '{"repo":"someone/plans","token":"a token"}')
  localStorage.setItem('dienius:sync', '{"url":"","token":"","enabled":true,"via":"github"}')

  eraseThisDevice()

  expect(localStorage.getItem('dienius:cloud-backup')).toBeNull()
  expect(localStorage.getItem('dienius:sync')).toBeNull()
})

test('an erase on a device with nothing on it is not an error', () => {
  expect(() => eraseThisDevice()).not.toThrow()
})
