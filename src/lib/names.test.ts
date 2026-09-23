import { expect, test } from 'vitest'
import { recipeTitle, templateName } from './names'

test('a name is shown as it was written', () => {
  expect(recipeTitle({ title: 'Lentil soup' })).toBe('Lentil soup')
  expect(templateName({ name: 'Rest day' })).toBe('Rest day')
})

test('an empty name, or one of spaces, is called what it is', () => {
  expect(recipeTitle({ title: '' })).toBe('Untitled recipe')
  expect(recipeTitle({ title: '   ' })).toBe('Untitled recipe')
  expect(templateName({ name: '' })).toBe('Untitled template')
  expect(templateName({ name: '\t' })).toBe('Untitled template')
})
