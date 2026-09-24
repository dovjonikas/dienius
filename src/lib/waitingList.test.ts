import { beforeEach, describe, expect, test } from 'vitest'
import { joinWaitingLists } from './waitingList'
import { actions, getData } from './store'
import { defaultData } from './storage'
import type { LibraryList, Template } from './types'

/**
 * A reading block waiting for a Library list by name - the extra stage of the
 * shift brief of 2026-09-25, and docs/TEMPLATE-JSON.md's `library`. A file
 * names a list the Library has not got yet; the block keeps the name and
 * reads from the list the moment the Library has one of that name, however
 * it arrives. Every name and title here is invented.
 */

const reading = (waiting?: string, listId?: string): Template => ({
  id: 'evening',
  name: 'An evening',
  color: '#a7c4f5',
  blocks: [
    { id: 'read', title: 'Read', time: '21:00', minutes: 30, ...(waiting ? { waitingLibrary: waiting } : {}), ...(listId ? { libraryListId: listId } : {}) },
    { id: 'walk', title: 'Walk', time: '18:00', minutes: 30 },
  ],
})

const shelf = (name: string, id = 'shelf'): LibraryList => ({ id, name, unit: 'chapter', items: [{ id: 'first', title: 'A first book' }] })

describe('joining a list by its name', () => {
  test('a block waiting for a name reads from the list of that name, whatever its case or spacing', () => {
    const templates = [reading('Evening  shelf')]
    const joined = joinWaitingLists(templates, [shelf('EVENING SHELF')])
    expect(joined[0].blocks[0].libraryListId).toBe('shelf')
    expect(joined[0].blocks[0].waitingLibrary).toBeUndefined()
    // The block beside it is not touched.
    expect(joined[0].blocks[1]).toBe(templates[0].blocks[1])
  })

  test('with no list of that name the block keeps waiting, and the templates are handed back as they were', () => {
    const templates = [reading('Evening shelf')]
    expect(joinWaitingLists(templates, [shelf('Another shelf')])).toBe(templates)
    expect(joinWaitingLists(templates, [])).toBe(templates)
  })

  test('a block already reading from a list is left alone', () => {
    const templates = [reading(undefined, 'older')]
    expect(joinWaitingLists(templates, [shelf('Evening shelf')])).toBe(templates)
  })
})

describe('every way a list arrives', () => {
  beforeEach(() => {
    localStorage.clear()
    actions.resetForTests({ ...defaultData(), templates: [reading('Evening shelf')] })
  })

  const block = () => getData().templates.find(t => t.id === 'evening')!.blocks[0]

  test('a shelf pasted at once makes the list, and the waiting block reads from it', () => {
    actions.importLibrary([{ list: 'EVENING SHELF', title: 'A first book', state: 'new' }])
    const made = getData().library.find(l => l.items.some(i => i.title === 'A first book'))!
    expect(block().libraryListId).toBe(made.id)
    expect(block().waitingLibrary).toBeUndefined()
  })

  test('a list made by hand with that name is read from', () => {
    const made = actions.addLibraryList({ name: 'Evening shelf', unit: 'chapter' })
    expect(block().libraryListId).toBe(made.id)
    expect(block().waitingLibrary).toBeUndefined()
  })

  test('a list renamed into that name is read from, and one renamed into another name is not', () => {
    const made = actions.addLibraryList({ name: 'Morning shelf', unit: 'chapter' })
    expect(block().waitingLibrary).toBe('Evening shelf')
    actions.updateLibraryList(made.id, { name: 'A shelf for later' })
    expect(block().libraryListId).toBeUndefined()
    actions.updateLibraryList(made.id, { name: 'evening shelf' })
    expect(block().libraryListId).toBe(made.id)
    expect(block().waitingLibrary).toBeUndefined()
  })
})
