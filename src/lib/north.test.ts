import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { retireGoals } from './north'
import { parseNorth } from './northSections'
import { dateKey } from './dates'
import type { AppData, Goal } from './types'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

// --- the text ----------------------------------------------------------------

/**
 * North is one text about the person you are becoming. One entity, because
 * it is one thing: there is no second text for two devices to fight over.
 */
test('the text is kept trimmed, and emptying it removes it rather than leaving a blank', () => {
  actions.setPicture('  I wake before the house does.  ')
  expect(getData().picture?.text).toBe('I wake before the house does.')
  actions.setPicture('   ')
  expect(getData().picture).toBeUndefined()
})

/**
 * The text starts empty - the app suggests none of it - and what is typed
 * is kept as typed: the blank lines between blocks are the person's own
 * structure and the one thing the store must never tidy. Only the ends of
 * the whole text are trimmed, so a blank line left after the last block is
 * not a block.
 */
test('North starts with no text at all', () => {
  expect(defaultData().picture).toBeUndefined()
  expect(getData().picture).toBeUndefined()
})

test('blank lines between blocks are kept exactly, and only the ends are trimmed', () => {
  const typed = '\nFirst line here\nSecond line here\n\nThird line here\n\n\nFourth line here\n\n'
  actions.setPicture(typed)
  expect(getData().picture?.text).toBe('First line here\nSecond line here\n\nThird line here\n\n\nFourth line here')
})

// Headings are read from the text and never written into it, so a text with
// them is stored by the same rule as one without: a line of spaces between
// paragraphs and the spaces at the end of a line are the person's, and only
// the two ends of the whole text go.
test('a text with headings is stored as typed, a line of spaces and the spaces inside a line kept, only the ends trimmed', () => {
  actions.setPicture('\n\n  FIRST HEADING\na line under it  \n   \n\na second paragraph under it\n\n')
  expect(getData().picture?.text).toBe('FIRST HEADING\na line under it  \n   \n\na second paragraph under it')
})

test('writing the same text again changes nothing, so nothing is stamped for it', () => {
  actions.setPicture('First line here\n\nSecond line here')
  const before = getData().picture
  actions.setPicture('First line here\n\nSecond line here')
  expect(getData().picture).toBe(before)
})

// --- goals retired, v2.28 ------------------------------------------------------
//
// North is one text, and goals are retired: nothing shows a goal any more.
// `retireGoals` is the one step between the two - see its comment in
// north.ts - and it runs at every door a plan comes in through, so these
// hold it to its three promises: nothing is lost, it happens once, and what
// it changed travels.

/** Noon UTC, so the date it archives on is the same date in every timezone a test runs in. */
const NOW = '2026-09-17T12:00:00.000Z'
const TODAY = dateKey(new Date(NOW))
const EARLIER = '2026-08-01T09:00:00.000Z'

function goal(over: Partial<Goal> = {}): Goal {
  return { id: crypto.randomUUID(), title: 'A goal title', createdAt: '2026-08-01', updatedAt: EARLIER, ...over }
}

function planWith(goals: Goal[], text?: string): AppData {
  const data = defaultData()
  data.goals = goals
  if (text !== undefined) data.picture = { text, updatedAt: EARLIER }
  return data
}

test("with no picture part in the text, the active goals' titles and whys become it, over the headings and the signature", () => {
  const data = planWith(
    [goal({ title: 'A first goal', why: 'a reason for it' }), goal({ title: 'A second goal' })],
    'FIRST HEADING\na line under it\n---\na signature line',
  )
  const retired = retireGoals(data, NOW)
  expect(retired.picture?.text).toBe(
    'A first goal\na reason for it\n\nA second goal\n\nFIRST HEADING\na line under it\n---\na signature line',
  )
  const reading = parseNorth(retired.picture!.text)
  expect(reading.intro).toEqual(['A first goal\na reason for it', 'A second goal'])
  expect(reading.sections).toEqual([{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }])
  expect(reading.signature).toEqual(['a signature line'])
})

test('with no text at all, the goals are the whole text', () => {
  const retired = retireGoals(planWith([goal({ title: 'A first goal', why: 'a reason for it' })]), NOW)
  expect(retired.picture?.text).toBe('A first goal\na reason for it')
})

test('a text with only a signature gets the goals over it', () => {
  const retired = retireGoals(planWith([goal({ title: 'A first goal' })], '---\na signature line'), NOW)
  expect(retired.picture?.text).toBe('A first goal\n\n---\na signature line')
  expect(parseNorth(retired.picture!.text).signature).toEqual(['a signature line'])
})

test("a goal's words are kept as written: the lines inside a why stay, only the ends are trimmed", () => {
  const retired = retireGoals(planWith([goal({ title: '  A first goal ', why: '\na first line\na second line  \n' })]), NOW)
  expect(retired.picture?.text).toBe('A first goal\na first line\na second line')
})

test('a text that already has a picture part is left exactly as it is', () => {
  const data = planWith([goal({ title: 'A first goal' })], 'A picture line\n\nFIRST HEADING\na line under it')
  const retired = retireGoals(data, NOW)
  expect(retired.picture).toBe(data.picture)
})

test('nothing is deleted: every active goal is archived today with every field it had, and the rules stay', () => {
  const full = goal({
    title: 'A first goal',
    why: 'a reason for it',
    identity: 'someone who does it',
    deserve: ['a thing done most days'],
    avoid: ['a thing not done'],
  })
  const data = planWith([full, goal({ title: 'A second goal' })])
  data.ifThens = [{ id: 'r1', trigger: 'a trigger', action: 'an action', goalId: full.id }]
  const retired = retireGoals(data, NOW)
  expect(retired.goals).toHaveLength(2)
  expect(retired.goals[0]).toEqual({ ...full, archivedAt: TODAY, updatedAt: NOW })
  expect(retired.goals.every(g => g.archivedAt === TODAY)).toBe(true)
  expect(retired.ifThens).toBe(data.ifThens)
})

test('a goal archived before is not moved into the text and keeps its own date and stamp', () => {
  const old = goal({ title: 'An archived goal', archivedAt: '2026-08-10' })
  const retired = retireGoals(planWith([old, goal({ title: 'An active goal' })]), NOW)
  expect(retired.picture?.text).toBe('An active goal')
  expect(retired.goals[0]).toBe(old)
})

/**
 * Stamped now, the way the inbox fold stamps its tombstones: a text and
 * goals that kept the stamps from the file would lose the next merge to the
 * older copy on another device, which still has the goals active and no
 * picture, and the move would be undone there and done again here forever.
 */
test('what it changed is stamped now, so the next sync carries it', () => {
  const retired = retireGoals(planWith([goal()], 'FIRST HEADING\na line under it'), NOW)
  expect(retired.picture?.updatedAt).toBe(NOW)
  expect(retired.goals[0].updatedAt).toBe(NOW)
})

test('a plan with no active goal is handed back as the same object, so doing it twice is doing it once', () => {
  const none = planWith([], 'FIRST HEADING\na line under it')
  expect(retireGoals(none, NOW)).toBe(none)
  const archived = planWith([goal({ archivedAt: '2026-08-10' })])
  expect(retireGoals(archived, NOW)).toBe(archived)

  const once = retireGoals(planWith([goal()]), NOW)
  expect(retireGoals(once, '2026-09-18T12:00:00.000Z')).toBe(once)
})

// The goals are archived rather than left active, and this is why: a text
// whose picture part is deleted months later must not take the goals back.
test('a picture part deleted later does not bring the goals back', () => {
  const once = retireGoals(planWith([goal({ title: 'A first goal' })], 'FIRST HEADING\na line under it'), NOW)
  const rewritten = { ...once, picture: { text: 'FIRST HEADING\na line under it', updatedAt: NOW } }
  expect(retireGoals(rewritten, '2026-10-01T12:00:00.000Z')).toBe(rewritten)
})
