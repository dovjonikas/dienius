import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateJsonSettings } from './TemplateJsonSettings'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'
import { templatesJson } from '../lib/templateJson'
import { todayKey } from '../lib/dates'
import { getUndo, runUndo } from '../lib/undo'

/**
 * Templates as JSON, in Settings - v2.33, docs/TEMPLATE-JSON.md: a text
 * pasted, previewed and applied, and the plan's templates and roster written
 * out in the same format. Every template and recipe here is an invented one.
 */

function example(): string {
  const doc = readFileSync(resolve(__dirname, '../../docs/TEMPLATE-JSON.md'), 'utf8').replace(/\r\n/g, '\n')
  return /```json\n([\s\S]*?)\n```/.exec(doc)![1] + '\n'
}

beforeEach(() => {
  const data = defaultData()
  data.recipes = [{ id: 'soup', title: 'A lentil soup', text: '' }]
  actions.resetForTests(data)
})

async function paste(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('textbox', { name: 'Templates and roster as JSON' }))
  await user.paste(text)
}

/** The preview's rows as they read: each row's name and what Apply does to it. */
function rows(list: string): [string, string][] {
  return within(screen.getByRole('list', { name: list }))
    .getAllByRole('listitem')
    .map(li => [li.querySelector('.template-json-name')?.textContent ?? '', li.querySelector('.template-json-action')?.textContent ?? ''])
}

test("the contract's example, pasted and previewed, says what Apply will make; Apply makes it, and one undo takes it back", async () => {
  const user = userEvent.setup()
  render(<TemplateJsonSettings />)
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  await paste(user, example())
  await user.click(screen.getByRole('button', { name: 'Preview' }))

  expect(rows('Templates in the file')).toEqual([
    ['Day shift', 'New'],
    ['Rest day', 'New'],
    ['Night shift', 'New'],
  ])
  expect(rows('Dates in the file')).toEqual([
    ['2030-01-07', 'D, Day shift'],
    ['2030-01-08', 'D, Day shift'],
    ['2030-01-09', 'N, Night shift'],
    ['2030-01-10', 'N, Night shift'],
    ['2030-01-11', 'R, Rest day'],
    ['2030-01-12', 'R, Rest day'],
  ])
  expect(screen.getByText('3 new templates. 6 dates set.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Apply' }))
  expect(getData().templates.map(t => t.name)).toEqual(['Day shift', 'Rest day', 'Night shift'])
  expect(getUndo()?.label).toBe('Templates imported')
  act(() => runUndo())
  expect(getData().templates).toEqual([])
})

test('a note is said under its template, and a date that is skipped says why', async () => {
  const user = userEvent.setup()
  render(<TemplateJsonSettings />)
  await paste(
    user,
    JSON.stringify({
      templates: [{ name: 'A day', blocks: [{ title: 'Lunch', mealType: 'lunch', recipes: ['A dish nobody wrote down'] }] }],
      roster: { '2030-01-07': 'Q' },
    }),
  )
  await user.click(screen.getByRole('button', { name: 'Preview' }))
  const day = within(screen.getByRole('list', { name: 'Templates in the file' })).getByRole('listitem')
  expect(within(day).getByText('Lunch: no recipe called "A dish nobody wrote down" in Kitchen - the block keeps its meal type.')).toBeInTheDocument()
  const date = within(screen.getByRole('list', { name: 'Dates in the file' })).getByRole('listitem')
  expect(within(date).getByText('Skipped')).toBeInTheDocument()
  expect(within(date).getByText('No kind of day has the letter or name "Q".')).toBeInTheDocument()
})

test('a text that cannot be read says why, and Apply stays off', async () => {
  const user = userEvent.setup()
  render(<TemplateJsonSettings />)
  await paste(user, '{ "templates": [')
  await user.click(screen.getByRole('button', { name: 'Preview' }))
  expect(screen.getByRole('alert')).toHaveTextContent(/^This is not JSON/)
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
})

test('a preview goes stale when the text changes: Apply waits for Preview again', async () => {
  const user = userEvent.setup()
  render(<TemplateJsonSettings />)
  await paste(user, example())
  await user.click(screen.getByRole('button', { name: 'Preview' }))
  expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
  await user.type(screen.getByRole('textbox', { name: 'Templates and roster as JSON' }), ' ')
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(screen.queryByRole('list', { name: 'Templates in the file' })).toBeNull()
})

test('Export writes the templates and the roster in the same format, ready to copy', async () => {
  const user = userEvent.setup()
  actions.importTemplatesJson(example())
  render(<TemplateJsonSettings />)
  await user.click(screen.getByRole('button', { name: 'Export' }))
  expect(screen.getByRole('textbox', { name: 'The templates and roster, as JSON' })).toHaveValue(templatesJson(getData(), todayKey()))
  expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
})
