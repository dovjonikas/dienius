import { expect, test } from 'vitest'
import { STARTER_TEMPLATES, starterTemplateInput } from './starterTemplates'
import { PALETTE_COLORS } from './colors'
import { actions } from './store'
import { defaultData } from './storage'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

test('there are exactly three starter offers', () => {
  expect(STARTER_TEMPLATES).toHaveLength(3)
})

test('every starter has a unique id, a name, a description, and at least one block', () => {
  const ids = new Set(STARTER_TEMPLATES.map(s => s.id))
  expect(ids.size).toBe(STARTER_TEMPLATES.length)
  for (const starter of STARTER_TEMPLATES) {
    expect(starter.name.trim()).not.toBe('')
    expect(starter.description.trim()).not.toBe('')
    expect(starter.blocks.length).toBeGreaterThan(0)
  }
})

test('every starter color comes from the shared palette, the same one templates use elsewhere', () => {
  const values = new Set(PALETTE_COLORS.map(c => c.value))
  for (const starter of STARTER_TEMPLATES) {
    expect(values.has(starter.color)).toBe(true)
  }
})

test('every timed block uses a real HH:MM time, and every block has a real title', () => {
  for (const starter of STARTER_TEMPLATES) {
    for (const block of starter.blocks) {
      if (block.time !== undefined) expect(block.time).toMatch(TIME_RE)
      expect(block.title.trim()).not.toBe('')
      if (block.minutes !== undefined) {
        expect(Number.isInteger(block.minutes)).toBe(true)
        expect(block.minutes).toBeGreaterThan(0)
      }
    }
  }
})

test('a non-full starter has at least one core block, so its reduced score has something to count', () => {
  for (const starter of STARTER_TEMPLATES) {
    if (starter.type === 'full') continue
    expect(starter.blocks.some(b => b.core)).toBe(true)
  }
})

test('a non-full starter also has at least one non-core block, so the reduced score is a real reduction', () => {
  for (const starter of STARTER_TEMPLATES) {
    if (starter.type === 'full') continue
    expect(starter.blocks.some(b => !b.core)).toBe(true)
  }
})

test('starterTemplateInput maps straight onto actions.addTemplate and produces a matching template', () => {
  actions.resetForTests(defaultData())
  const starter = STARTER_TEMPLATES[0]
  const template = actions.addTemplate(starterTemplateInput(starter))
  expect(template.name).toBe(starter.name)
  expect(template.color).toBe(starter.color)
  expect(template.type).toBe(starter.type)
  expect(template.blocks).toHaveLength(starter.blocks.length)
  expect(template.blocks[0]).toMatchObject({
    time: starter.blocks[0].time,
    title: starter.blocks[0].title,
  })
})

test('the three starters cover the three named shapes: a working day, a rest day, an overnight shift', () => {
  const types = STARTER_TEMPLATES.map(s => s.type).sort()
  expect(types).toEqual(['full', 'night', 'rest'])
})
