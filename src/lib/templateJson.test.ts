import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { readTemplatesJson, templatesJson } from './templateJson'
import { joinWaitingRecipes } from './waitingRecipes'
import { defaultData } from './storage'
import { kindOnDate } from './dayKinds'
import type { AppData, Recipe, Template } from './types'

/**
 * Templates and the roster as JSON - v2.33, docs/TEMPLATE-JSON.md. A text in
 * the contract's format is read into what it will do, and done; the templates
 * and the roster come back out in the same format, the same text every time.
 * Every template, block, recipe and date here is an invented one.
 */

const TODAY = '2030-01-01'

/** The contract's own example, as the document writes it. */
function example(): string {
  const doc = readFileSync(resolve(__dirname, '../../docs/TEMPLATE-JSON.md'), 'utf8').replace(/\r\n/g, '\n')
  const found = /```json\n([\s\S]*?)\n```/.exec(doc)
  if (!found) throw new Error('the contract has no example')
  return found[1] + '\n'
}

const SOUP: Recipe = { id: 'soup', title: 'A lentil soup', text: '', mealTypes: ['lunch'] }

/** A fresh app with one recipe, the one the example names. */
function fresh(): AppData {
  const data = defaultData()
  data.recipes = [SOUP]
  return data
}

function imported(text: string, data: AppData = fresh(), today = TODAY) {
  return readTemplatesJson(text, data, today)
}

const named = (data: AppData, name: string) => data.templates.find(t => t.name === name) as Template

describe('the contract', () => {
  test("the contract's example reads with no notes, and exports as itself, character for character", () => {
    const text = example()
    const read = imported(text)
    expect(read.error).toBeUndefined()
    expect(read.notes).toEqual([])
    expect(read.templates.map(t => [t.name, t.action, t.notes])).toEqual([
      ['Day shift', 'create', []],
      ['Rest day', 'create', []],
      ['Night shift', 'create', []],
    ])
    expect(read.roster.map(r => [r.date, r.letter, r.action])).toEqual([
      ['2030-01-07', 'D', 'set'],
      ['2030-01-08', 'D', 'set'],
      ['2030-01-09', 'N', 'set'],
      ['2030-01-10', 'N', 'set'],
      ['2030-01-11', 'R', 'set'],
      ['2030-01-12', 'R', 'set'],
    ])
    expect(templatesJson(read.data, TODAY)).toBe(text)
  })

  test('exported, imported and exported again, the text is the same - into the same app and into a fresh one', () => {
    const once = imported(example()).data
    const text = templatesJson(once, TODAY)
    // Into the app it came from: nothing to do, and the same plan back.
    const again = imported(text, once)
    expect(again.templates.every(t => t.action === 'unchanged')).toBe(true)
    expect(again.roster.every(r => r.action === 'unchanged')).toBe(true)
    expect(again.data).toBe(once)
    // Into a fresh app: the same text out.
    expect(templatesJson(imported(text).data, TODAY)).toBe(text)
  })

  test('the templates keep what the file gives them: the type, the letter in cycle order, the colour, the sleep and the blocks', () => {
    const data = imported(example()).data
    const night = named(data, 'Night shift')
    expect(night).toMatchObject({ type: 'night', color: '#c9b3f0', dayKind: { letter: 'N', order: 2 } })
    expect(data.settings.sleepProfiles.find(p => p.id === night.sleepProfileId)).toMatchObject({ name: '08:30-15:30', window: { start: '08:30', end: '15:30' } })
    expect(night.blocks.map(b => [b.time, b.title, b.minutes, b.category, !!b.afterMidnight])).toEqual([
      ['18:00', 'Travel in', 45, 'commute', false],
      ['19:00', 'Shift', 720, 'core', false],
      ['01:00', 'Night meal', 30, 'meal', true],
      ['07:15', 'Travel home', 45, 'commute', true],
    ])
    expect(named(data, 'Day shift').blocks[2]).toMatchObject({ recipeIds: ['soup'], recipeId: 'soup' })
    expect(named(data, 'Day shift').blocks[2].mealType).toBeUndefined()
    // A rest day with no sleep of its own wakes from the first schedule.
    expect(named(data, 'Rest day').sleepProfileId).toBeUndefined()
  })
})

describe('the roster', () => {
  test("a night's block after midnight lands on the next morning once the roster is imported", () => {
    const data = imported(example()).data
    expect(kindOnDate(data, '2030-01-09')?.name).toBe('Night shift')
    const morning = data.days['2030-01-10'].tasks
    const meal = morning.find(t => t.title === 'Night meal' && t.nightOf === '2030-01-09')
    expect(meal).toMatchObject({ time: '01:00', minutes: 30 })
    // The morning after the last night, a rest day, holds that night's journey home.
    expect(data.days['2030-01-11'].tasks.find(t => t.title === 'Travel home' && t.nightOf === '2030-01-10')).toMatchObject({ time: '07:15' })
  })

  test('a date is set by a letter or by a name, taken off by null, and skipped behind today or for a kind nobody has', () => {
    const start = imported(example()).data
    const read = imported(
      JSON.stringify({
        roster: {
          '2029-12-31': 'D',
          '2030-01-07': 'Night shift',
          '2030-01-08': null,
          '2030-01-13': 'x',
          '2030-01-14': 'Nobody',
          '2030-02-30': 'D',
        },
      }),
      start,
    )
    expect(read.roster.map(r => [r.date, r.action, r.note ?? ''])).toEqual([
      ['2029-12-31', 'skip', 'Before today - a lived day keeps what it was.'],
      ['2030-01-07', 'set', ''],
      ['2030-01-08', 'clear', ''],
      ['2030-01-13', 'skip', 'No kind of day has the letter or name "x".'],
      ['2030-01-14', 'skip', 'No kind of day has the letter or name "Nobody".'],
      ['2030-02-30', 'skip', '"2030-02-30" is not a date.'],
    ])
    expect(kindOnDate(read.data, '2030-01-07')?.name).toBe('Night shift')
    expect(kindOnDate(read.data, '2030-01-08')).toBeUndefined()
    // A night set on the 7th brings its hours after midnight to the 8th,
    // whose own kind was taken off - the way the Roster's Apply lays them.
    expect(read.data.days['2030-01-08'].tasks.filter(t => t.nightOf === '2030-01-07').map(t => t.title)).toEqual(['Night meal', 'Travel home'])
  })

  test('a template that is not a kind of day is skipped on the roster, with why', () => {
    const start = imported(JSON.stringify({ templates: [{ name: 'A plain day', blocks: [] }] })).data
    const read = imported(JSON.stringify({ roster: { '2030-01-07': 'A plain day' } }), start)
    expect(read.roster).toMatchObject([{ date: '2030-01-07', action: 'skip', note: '"A plain day" is not a kind of day - give it a letter.' }])
  })
})

describe('what is left out, and why', () => {
  test('a recipe Kitchen does not have is said, and the block keeps its meal type alone', () => {
    const read = imported(
      JSON.stringify({
        templates: [
          {
            name: 'A day',
            blocks: [{ time: '12:00', title: 'Lunch', category: 'Meals', mealType: 'lunch', recipes: ['A dish nobody wrote down'] }],
          },
        ],
      }),
    )
    expect(read.templates[0].notes).toEqual([
      'Lunch: no recipe called "A dish nobody wrote down" in Kitchen yet - the block waits for it, and takes it when a recipe of that name is added; until then it keeps its meal type.',
    ])
    const block = named(read.data, 'A day').blocks[0]
    expect(block).toMatchObject({ mealType: 'lunch', category: 'meal' })
    expect(block.recipeIds).toBeUndefined()
    // Kept by name, so the block takes it the moment Kitchen has one - see
    // lib/waitingRecipes.ts - and the file still names it on the way out.
    expect(block.waitingRecipes).toEqual(['A dish nobody wrote down'])
    expect(templatesJson(read.data, TODAY)).toContain('"recipes": ["A dish nobody wrote down"]')
  })

  test('a block waiting for a recipe takes it as soon as Kitchen has one of that name', () => {
    const read = imported(
      JSON.stringify({
        templates: [
          {
            name: 'A day',
            blocks: [
              { time: '12:00', title: 'Lunch', mealType: 'lunch', recipes: ['A bean bowl', 'A lentil soup'] },
              { time: '19:00', title: 'Dinner', mealType: 'dinner', recipes: ['A bean bowl'] },
            ],
          },
        ],
      }),
    )
    const waiting = named(read.data, 'A day')
    expect(waiting.blocks[0].recipeIds).toEqual(['soup'])
    expect(waiting.blocks[0].waitingRecipes).toEqual(['A bean bowl'])

    // The bowl arrives, written however it was named.
    const bowl: Recipe = { id: 'bowl', title: 'a  BEAN bowl', text: '', mealTypes: ['lunch'] }
    const joined = joinWaitingRecipes(read.data.templates, [...read.data.recipes, bowl])
    expect(joined[0].blocks[0].recipeIds).toEqual(['soup', 'bowl'])
    expect(joined[0].blocks[0].waitingRecipes).toBeUndefined()
    // The block that had only the name takes it, and its meal type gives way
    // to the recipe, as a block with a recipe always has.
    expect(joined[0].blocks[1].recipeIds).toEqual(['bowl'])
    expect(joined[0].blocks[1].mealType).toBeUndefined()
    expect(joined[0].blocks[1].waitingRecipes).toBeUndefined()
  })

  test('a name still nobody has keeps waiting, and the plan is left alone when nothing arrives', () => {
    const read = imported(
      JSON.stringify({
        templates: [{ name: 'A day', blocks: [{ time: '12:00', title: 'Lunch', mealType: 'lunch', recipes: ['A bean bowl', 'A rice bowl'] }] }],
      }),
    )
    expect(joinWaitingRecipes(read.data.templates, read.data.recipes)).toBe(read.data.templates)

    const bowl: Recipe = { id: 'bowl', title: 'A bean bowl', text: '' }
    const joined = joinWaitingRecipes(read.data.templates, [...read.data.recipes, bowl])
    expect(joined[0].blocks[0].recipeIds).toEqual(['bowl'])
    expect(joined[0].blocks[0].waitingRecipes).toEqual(['A rice bowl'])
  })

  test('a wrong field is left out with a note, and the rest of its template and block are read', () => {
    const read = imported(
      JSON.stringify({
        templates: [
          {
            name: 'A day',
            type: 'weekend',
            color: 'blue',
            sleep: { from: '23:00', to: '23:00' },
            shade: 'dark',
            blocks: [
              { time: '25:00', title: 'Walk', minutes: -5, category: 'Hobbies', core: 'yes', size: 3 },
              { title: 'Late one', afterMidnight: true },
              { minutes: 10 },
            ],
          },
        ],
      }),
    )
    expect(read.templates[0].action).toBe('create')
    expect(read.templates[0].notes).toEqual([
      'type "weekend" is not full, shift, night or rest - left out.',
      'color "blue" is not a #rrggbb colour - left out.',
      'sleep needs two different times, from and to - left out.',
      '"shade" is not a field of a template - left out.',
      'Walk: time "25:00" is not HH:MM - left out.',
      'Walk: minutes -5 is not a whole number from 1 to 1440 - left out.',
      'Walk: no category called "Hobbies" - left out.',
      'Walk: core must be true or false - left out.',
      'Walk: "size" is not a field of a block - left out.',
      'Late one: afterMidnight needs a time - left out.',
      'Block 3 has no title - skipped.',
    ])
    const day = named(read.data, 'A day')
    expect(day.type).toBeUndefined()
    expect(day.blocks.map(b => [b.title, b.time, b.minutes, b.category, b.core, b.afterMidnight])).toEqual([
      ['Walk', undefined, undefined, undefined, undefined, undefined],
      ['Late one', undefined, undefined, undefined, undefined, undefined],
    ])
  })

  test('one bad entry never stops the rest: a template with no name is skipped, the others are read', () => {
    const read = imported(JSON.stringify({ templates: [{ blocks: [] }, 'a string', { name: 'A good one' }] }))
    expect(read.templates.map(t => [t.name, t.action, t.notes])).toEqual([
      ['Template 1', 'skip', ['It has no name - skipped.']],
      ['Template 2', 'skip', ['It is not an object - skipped.']],
      ['A good one', 'create', []],
    ])
    expect(read.data.templates.map(t => t.name)).toEqual(['A good one'])
  })

  test('a letter another template has is left out, and the template comes in without one', () => {
    const start = imported(example()).data
    const read = imported(JSON.stringify({ templates: [{ name: 'Early shift', kind: 'd' }] }), start)
    expect(read.templates[0].notes).toEqual(['kind "D" is Day shift\'s already - left out.'])
    expect(named(read.data, 'Early shift').dayKind).toBeUndefined()
  })

  test('a text that is not JSON, not an object, or another format is not read at all, and says why', () => {
    expect(imported('{ "templates": [').error).toMatch(/^This is not JSON/)
    expect(imported('[1, 2]').error).toBe('This is not a JSON object.')
    expect(imported('{ "format": "something-else" }').error).toBe('This is not a Dienius templates file: its format is "something-else".')
    expect(imported('{ "version": 2 }').error).toBe('This is version 2 of the format; this app reads version 1.')
    expect(imported('{ "tempaltes": [] }').notes).toEqual(['"tempaltes" is not a field of the file - left out.'])
  })
})

describe('an update', () => {
  test('a template of the same name is updated, never copied, and a block of the same title keeps its id and what the format does not carry', () => {
    const start = imported(example()).data
    const shift = named(start, 'Day shift')
    const withSteps: AppData = {
      ...start,
      templates: start.templates.map(t =>
        t.id !== shift.id ? t : { ...t, blocks: t.blocks.map(b => (b.title === 'Travel in' ? { ...b, steps: [{ id: 's1', title: 'Keys' }] } : b)) },
      ),
    }
    const read = imported(
      JSON.stringify({ templates: [{ name: ' day  SHIFT ', kind: 'D', blocks: [{ time: '05:45', title: 'Travel in', minutes: 45 }] }] }),
      withSteps,
    )
    expect(read.templates[0]).toMatchObject({ name: ' day  SHIFT ', action: 'update' })
    const after = read.data.templates.filter(t => t.name.toLowerCase().includes('shift'))
    expect(after.map(t => t.name)).toEqual(['Day shift', 'Night shift'])
    const updated = named(read.data, 'Day shift')
    expect(updated.id).toBe(shift.id)
    expect(updated.blocks).toHaveLength(1)
    expect(updated.blocks[0]).toMatchObject({ id: shift.blocks[0].id, time: '05:45', steps: [{ id: 's1', title: 'Keys' }] })
    // What the file does not say is kept: the colour, the sleep, the letter's place.
    expect(updated).toMatchObject({ color: '#a7c4f5', sleepProfileId: shift.sleepProfileId, dayKind: { letter: 'D', order: 0 } })
  })

  test('the same text imported twice changes nothing the second time', () => {
    const once = imported(example())
    const twice = imported(example(), once.data)
    expect(twice.data).toBe(once.data)
    expect(twice.templates.map(t => t.action)).toEqual(['unchanged', 'unchanged', 'unchanged'])
  })
})
