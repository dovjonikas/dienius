import { beforeEach, describe, expect, it } from 'vitest'
import { seedLibrary } from './librarySeed'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { isItemFinished, progressLabel, upNext } from './library'
import { stampChanges } from './syncEntities'
import { mergeStates } from './syncMerge'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

function lane(name: string) {
  return getData().library.find(l => l.name === name)
}

/**
 * The one place in this app that creates something without being asked, and
 * the guard that keeps it honest. The rule is not "skip items that already
 * exist" - that would fight somebody who deleted one on purpose and put it
 * back every morning. It is "a list with anything in it is left completely
 * alone", which means one item from any source stops that lane forever.
 *
 * The plan became three lists in v2.0. These tests changed with it: every
 * assertion about a single "Books" list is now an assertion about one of
 * three lanes, and the reason for the split is a behaviour rather than
 * tidiness - see the last group below, and the doc comment on librarySeed.ts.
 */
describe('the reading plan seed', () => {
  it('puts three lanes in, each in its own order', () => {
    actions.seedLibrary()
    expect(getData().library.map(l => l.name)).toEqual(['MIND', 'CRAFT', 'LIGHT'])
    expect(lane('MIND')?.items.map(i => i.title)).toEqual([
      'The War of Art',
      'The Courage to Be Disliked',
      'Daring Greatly',
      'Attached',
      'The Status Game',
      'How to Fail at Almost Everything and Still Win Big',
      'Sapiens',
      'Models',
      'Atomic Habits',
      'Four Thousand Weeks',
    ])
    expect(lane('CRAFT')?.items.map(i => i.title)).toEqual([
      'Turning Pro',
      'The Missing README',
      'The Pragmatic Programmer',
      'Never Split the Difference',
      'Deep Work',
    ])
    expect(lane('LIGHT')?.items.map(i => i.title)).toEqual([
      'The Psychology of Money',
      'Siddhartha',
      'You Are Not So Smart',
      'The Subtle Art of Not Giving a F*ck',
      'Crime and Punishment',
      'Musashi',
    ])
  })

  it('carries the pace note and how each one is counted', () => {
    actions.seedLibrary()
    const mind = lane('MIND')!
    const war = mind.items[0]
    expect(war.track).toBe('pages')
    expect(war.pace).toBe('one section a day - finish Book Two, skim Book Three')
    // No total, because nobody knows it. An invented number is worse than a
    // missing one: it looks like a fact.
    expect(war.total).toBeUndefined()
    expect(progressLabel(mind, war)).toBe('p. 0')
    expect(mind.items.find(i => i.title === 'Sapiens')?.total).toBe(20)
    expect(lane('CRAFT')!.items.find(i => i.title === 'Deep Work')?.total).toBeUndefined()
    expect(lane('LIGHT')!.items.find(i => i.title === 'Musashi')?.pace).toBe('winter')
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

  it('leaves a lane that already has something in it completely alone', () => {
    const list = actions.addLibraryList({ name: 'MIND', unit: 'chapter' })
    actions.addLibraryItem(list.id, 'The Odyssey')
    actions.seedLibrary()
    expect(lane('MIND')?.items.map(i => i.title)).toEqual(['The Odyssey'])
  })

  /**
   * Each lane is decided on its own terms, so a run that found one of them
   * already in use still does its job for the other two. The alternative - a
   * single all-or-nothing guard - would mean somebody who had started a MIND
   * list by hand could never get CRAFT or LIGHT at all.
   */
  it('fills the lanes that are empty and skips the one that is not', () => {
    const mind = actions.addLibraryList({ name: 'MIND', unit: 'chapter' })
    actions.addLibraryItem(mind.id, 'The Odyssey')
    actions.seedLibrary()

    expect(lane('MIND')?.items.map(i => i.title)).toEqual(['The Odyssey'])
    expect(lane('CRAFT')?.items).toHaveLength(5)
    expect(lane('LIGHT')?.items).toHaveLength(6)
  })

  it('fills a lane somebody made and never used, rather than making a second one', () => {
    actions.addLibraryList({ name: 'CRAFT', unit: 'chapter' })
    actions.seedLibrary()
    expect(lane('CRAFT')?.items).toHaveLength(5)
    expect(getData().library.filter(l => l.name === 'CRAFT')).toHaveLength(1)
  })

  it('does not touch any other list', () => {
    const watching = actions.addLibraryList({ name: 'Watching', unit: 'episode' })
    actions.addLibraryItem(watching.id, 'Invincible, 3 seasons')
    actions.seedLibrary()
    expect(getData().library.map(l => l.name)).toEqual(['Watching', 'MIND', 'CRAFT', 'LIGHT'])
    expect(getData().library[0].items.map(i => i.title)).toEqual(['Invincible'])
  })

  it('leaves everything in it going, because nothing here has been read yet', () => {
    actions.seedLibrary()
    expect(getData().library.every(l => l.items.every(i => !isItemFinished(i)))).toBe(true)
  })
})

/**
 * The behaviour the split is actually for.
 *
 * One queue of twenty means everything is behind whatever is at the front of
 * it, and finishing a light thing on a Tuesday evening offers the next heavy
 * one. Each lane advancing on its own is what makes "what do I read now"
 * answerable in the state somebody is in when they ask it.
 */
describe('each lane moves on its own', () => {
  it('offers the next book from the lane the finished one was in', () => {
    actions.seedLibrary()
    const light = lane('LIGHT')!
    actions.toggleLibraryItemFinished(light.id, light.items[0].id, '2026-09-04')

    const offer = upNext(lane('LIGHT')!, '2026-09-04')
    expect(offer?.finished.title).toBe('The Psychology of Money')
    expect(offer?.next.title).toBe('Siddhartha')
    // Nothing was finished in MIND, so MIND has nothing to announce.
    expect(upNext(lane('MIND')!, '2026-09-04')).toBeUndefined()
  })
})

/**
 * Found by syncing two devices in a browser, which is the only place it could
 * have been found: each one seeded its own Books list with its own random
 * ids, the merge unioned them by id the way it unions anything else, and the
 * second device ended up with two lists both called Books and eighteen books
 * between them.
 *
 * Sync merges per entity, so the only way two devices can seed the same thing
 * independently and end up with one of it is for the thing to carry the same
 * identity on both. Three lanes is three times the chance of getting this
 * wrong, which is why it is checked across all of them.
 */
describe('two devices seeding independently', () => {
  it('produce the same entities, so a merge leaves three lanes and no duplicates', () => {
    const phone = stampChanges(defaultData(), seedLibrary(defaultData()), '2026-09-01T08:00:00.000Z')
    const pc = stampChanges(defaultData(), seedLibrary(defaultData()), '2026-09-01T20:00:00.000Z')

    const merged = mergeStates(phone, pc, '2026-09-02T09:00:00.000Z').data
    expect(merged.library.map(l => l.name)).toEqual(['MIND', 'CRAFT', 'LIGHT'])
    expect(merged.library.map(l => l.items.length)).toEqual([10, 5, 6])
    for (const list of merged.library) {
      expect(new Set(list.items.map(i => i.id)).size).toBe(list.items.length)
    }
  })

  it('agree on every id, down to the item', () => {
    const a = seedLibrary(defaultData())
    const b = seedLibrary(defaultData())
    expect(a.library.map(l => l.id)).toEqual(b.library.map(l => l.id))
    expect(a.library.flatMap(l => l.items.map(i => i.id))).toEqual(b.library.flatMap(l => l.items.map(i => i.id)))
  })

  it('gives every book across the three lanes a distinct id', () => {
    const seeded = seedLibrary(defaultData())
    const ids = seeded.library.flatMap(l => l.items.map(i => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
