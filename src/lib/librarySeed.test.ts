import { beforeEach, describe, expect, it } from 'vitest'
import { seedLibrary } from './librarySeed'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { isItemFinished, progressLabel } from './library'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function books() {
  return getData().library.find(l => l.name === 'Books')
}

/**
 * The one place in this app that creates something without being asked, and
 * the guard that keeps it honest. The rule is not "skip items that already
 * exist" - that would fight somebody who deleted one on purpose and put it
 * back every morning. It is "a list with anything in it is left completely
 * alone", which means one item from any source stops this forever.
 */
describe('the reading plan seed', () => {
  it('puts the queue in, in order, on an install with no Books list', () => {
    actions.seedLibrary()
    expect(books()?.items.map(i => i.title)).toEqual([
      'The War of Art',
      'The Psychology of Money',
      'Turning Pro',
      'The Courage to Be Disliked',
      'Daring Greatly',
      'The Status Game',
      'Sapiens',
      'Atomic Habits',
      'You Are Not So Smart',
    ])
  })

  it('carries the pace note and how each one is counted', () => {
    actions.seedLibrary()
    const list = books()!
    const war = list.items[0]
    expect(war.track).toBe('pages')
    expect(war.pace).toBe('one section a day - finish Book Two, skim Book Three')
    // No total, because nobody knows it. An invented number is worse than a
    // missing one: it looks like a fact.
    expect(war.total).toBeUndefined()
    expect(progressLabel(list, war)).toBe('p. 0')
    expect(list.items.find(i => i.title === 'Sapiens')?.total).toBe(20)
  })

  it('does nothing at all the second time', () => {
    actions.seedLibrary()
    const before = getData()
    actions.seedLibrary()
    // The same object, not merely an equal one: the caller skips the commit
    // on that, so an ordinary open does not write, stamp and sync a state
    // identical to the one it started from.
    expect(seedLibrary(before)).toBe(before)
    expect(getData()).toBe(before)
  })

  it('leaves a Books list that already has something in it completely alone', () => {
    const list = actions.addLibraryList({ name: 'Books', unit: 'chapter' })
    actions.addLibraryItem(list.id, 'The Odyssey')
    actions.seedLibrary()
    expect(books()?.items.map(i => i.title)).toEqual(['The Odyssey'])
  })

  it('fills a Books list somebody made and never used', () => {
    // The starter offer creates exactly this: a named, empty list. Filling it
    // is what somebody who tapped "Start a Books list" was asking for.
    actions.addLibraryList({ name: 'Books', unit: 'chapter' })
    actions.seedLibrary()
    expect(books()?.items).toHaveLength(9)
    expect(getData().library).toHaveLength(1)
  })

  it('does not touch any other list', () => {
    const watching = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
    actions.addLibraryItem(watching.id, 'Invincible, 3 seasons')
    actions.seedLibrary()
    expect(getData().library.map(l => l.name)).toEqual(['Watching', 'Books'])
    expect(getData().library[0].items.map(i => i.title)).toEqual(['Invincible'])
  })

  it('leaves everything in it going, because nothing here has been read yet', () => {
    actions.seedLibrary()
    expect(books()!.items.every(i => !isItemFinished(i))).toBe(true)
  })
})
