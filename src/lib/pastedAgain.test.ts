import { beforeEach, describe, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { readPastedRecipes } from './recipeImport'
import { readPastedLibrary } from './libraryPaste'
import { parseNorth } from './northSections'
import { withPicture } from './north'
import type { AppData } from './types'

/**
 * The three pastes the owner makes from things written elsewhere - Kitchen's
 * recipes, the Library's shelf, North's text - each held the same three ways,
 * the owner's shift brief of 2026-09-25, stage 6: what the preview says is
 * what Save does, the same text pasted a second time changes nothing, and one
 * undo puts back everything the paste did. Every name here is invented.
 */

/** The plan's content with the stamps the app writes by itself left out, to compare two states of it. */
function content(data: AppData): unknown {
  return JSON.parse(JSON.stringify(data), (key, value) => (key === 'updatedAt' || key === 'settingsUpdatedAt' || key === 'tombstones' ? undefined : value))
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

describe("Kitchen's recipes", () => {
  const TEXT = ['NAME: Breakfast oat bowl\n410 kcal\n22 g protein\nINGREDIENTS\noats\nSTEPS\nCook.', 'NAME: Lunch lentil soup\n450 kcal\n30 g protein'].join('\n')
  const paste = () => {
    const rows = readPastedRecipes(TEXT, getData().recipes, getData().settings.mealWords ?? [])
    return { rows, done: actions.importRecipes(rows.map(row => ({ ...row.input, existingId: row.existingId }))) }
  }

  test('the preview says what Save makes, the second paste changes nothing, and one undo takes it all back', () => {
    const before = getData()
    const first = paste()
    expect(first.rows.map(r => [r.title, r.state, r.kcal, r.protein])).toEqual([
      ['Breakfast oat bowl', 'new', 410, 22],
      ['Lunch lentil soup', 'new', 450, 30],
    ])
    expect(getData().recipes.map(r => [r.title, r.kcal, r.protein])).toEqual([
      ['Breakfast oat bowl', 410, 22],
      ['Lunch lentil soup', 450, 30],
    ])
    const once = content(getData())

    const second = paste()
    expect(second.rows.map(r => r.state)).toEqual(['update', 'update'])
    expect(content(getData())).toEqual(once)

    second.done.undo()
    first.done.undo()
    expect(getData().recipes).toEqual(before.recipes)
  })
})

describe("the Library's shelf", () => {
  const TEXT = ['MAIN', 'A first book - An author', 'A second book - Another author', 'SIDE', 'A short one'].join('\n')
  const paste = () => {
    const read = readPastedLibrary(TEXT, getData().library, '')
    return { read, done: actions.importLibrary(read.rows) }
  }

  test('the preview says what Save makes, the second paste changes nothing, and one undo takes it all back', () => {
    const first = paste()
    expect(first.read.rows.map(r => [r.list, r.title, r.author ?? '', r.state])).toEqual([
      // A list line in capitals names its list the way the Library writes one.
      ['Main', 'A first book', 'An author', 'new'],
      ['Main', 'A second book', 'Another author', 'new'],
      ['Side', 'A short one', '', 'new'],
    ])
    expect(first.read.newLists).toEqual(['Main', 'Side'])
    expect(getData().library.map(l => [l.items.map(i => i.title)])).toEqual([[['A first book', 'A second book']], [['A short one']]])
    const once = content(getData())

    const second = paste()
    expect(second.read.rows.map(r => r.state)).toEqual(['update', 'update', 'update'])
    expect(second.read.newLists).toEqual([])
    expect(content(getData())).toEqual(once)

    second.done.undo()
    first.done.undo()
    expect(getData().library).toEqual([])
  })
})

describe("North's text", () => {
  const TEXT = ['A first line.', '', 'WHAT MATTERS [morning]', 'A line.', '', 'THE EVENING [evening]', 'Another.', '---', 'A signature.'].join('\n')

  test('what the preview reads is what Replace makes, the second replace changes nothing, and one undo puts the old text back', () => {
    actions.setPicture('AN OLD HEADING\nAn old line.')
    const before = getData().picture?.text
    // The preview reads the text the way the page will.
    const read = parseNorth(TEXT)
    expect(read.sections.map(s => [s.heading, s.tag ?? ''])).toEqual([
      ['WHAT MATTERS', 'morning'],
      ['THE EVENING', 'evening'],
    ])
    actions.setPicture(TEXT)
    expect(getData().picture?.text).toBe(TEXT)
    const once = content(getData())

    actions.setPicture(TEXT)
    expect(content(getData())).toEqual(once)
    expect(content(withPicture(getData(), TEXT))).toEqual(once)

    // The undo the page offers puts the text there before back.
    actions.setPicture(before!)
    expect(getData().picture?.text).toBe('AN OLD HEADING\nAn old line.')
  })
})
