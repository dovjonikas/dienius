import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { activeGoals, deserveForWeek } from '../../lib/north'
import { parseNorth } from '../../lib/northSections'
import { MAX_ACTIVE_GOALS, MAX_RULES_PER_GOAL } from '../../lib/types'
import { northReadOn } from '../../lib/northRead'

const TODAY = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
})

function goal(title: string, more: { why?: string; identity?: string; deserve?: string[]; avoid?: string[] } = {}) {
  return actions.addGoal({ title, ...more }, '2026-09-01')!
}

function picture(text: string) {
  actions.setPicture(text)
}

/**
 * North, since v2.24: one page, one column. A quiet goal at the top, the
 * text under it - the introduction, the headings and the signature - and
 * one field for writing the text. Every line and goal in these tests is a
 * generic one: the app carries nobody's words and neither does this file.
 */

// --- the empty page, and writing ---------------------------------------------

/**
 * The text, since v2.24: an empty North is one line and one button, not a
 * field waiting on the page; Write and Edit open one textarea holding the
 * whole text, with Save and Cancel under it, and nothing is written until
 * Save. What is typed is kept as typed. Every line in these tests is a
 * generic one - the app suggests none of this text and the tests carry none
 * of anybody's.
 */
test('with nothing written, the page is one line and one button, and no field', () => {
  render(<NorthView />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText('Write the words you want to start each day with.')).toBeInTheDocument()
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Write'])
})

test('Write opens the field with the rule said once above it, and nothing to save until something is typed', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  expect(box).toHaveFocus()
  const rule = 'A line in capitals becomes a heading. A line with --- starts the signature.'
  expect(box).toHaveAccessibleDescription(rule)
  expect(screen.getAllByText(rule)).toHaveLength(1)
  // The example in the empty field shows every part the page reads, by the
  // page's own rule: an introduction, headings, and a signature.
  const example = parseNorth(box.getAttribute('placeholder') ?? '')
  expect(example.intro.length).toBeGreaterThan(0)
  expect(example.sections.length).toBeGreaterThan(1)
  expect(example.sections.every(section => section.paragraphs.length > 0)).toBe(true)
  expect(example.signature.length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Save', 'Cancel'])
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('nothing is written while typing, and Save writes the text as typed and goes back to reading', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), 'a first line{Enter}{Enter}FIRST HEADING{Enter}a line under it')
  // A pause is not a save any more.
  await new Promise(resolve => setTimeout(resolve, 700))
  expect(getData().picture).toBeUndefined()

  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().picture?.text).toBe('a first line\n\nFIRST HEADING\na line under it')
  expect(screen.queryByRole('textbox', { name: 'North' })).toBeNull()
  expect(screen.getByRole('heading', { level: 3, name: 'FIRST HEADING' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

test('Edit opens the field holding the text exactly, and Cancel drops what was typed', async () => {
  const user = userEvent.setup()
  picture('a first line\n\n\nFIRST HEADING\na line under it')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  expect(box).toHaveValue('a first line\n\n\nFIRST HEADING\na line under it')
  await user.type(box, '{Enter}a line nobody keeps')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(getData().picture?.text).toBe('a first line\n\n\nFIRST HEADING\na line under it')
  expect(screen.queryByRole('textbox', { name: 'North' })).toBeNull()
  expect(screen.queryByText('a line nobody keeps')).toBeNull()
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
})

test('Cancel on a page with nothing written goes back to the one line and the one button', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), 'a first line')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().picture).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Write' })).toHaveFocus()
})

// Nothing typed is lost to a press somewhere else: leaving the page with the
// field open keeps what is in it. Cancel is the one way to drop it.
test('leaving the page with the field open keeps what was typed', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), 'a first line')
  unmount()
  expect(getData().picture?.text).toBe('a first line')
})

test('emptying the text and saving removes it, and the page is the one line and the one button again', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.clear(screen.getByRole('textbox', { name: 'North' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().picture).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Write' })).toBeInTheDocument()
})

/**
 * The one help the field gives: a line in capitals is drawn as a heading
 * while it is typed, so what will be a heading is seen before Save. The
 * field's own text is invisible and a drawing of the same text sits under
 * it, so the drawing has to say exactly what the field holds, line for line
 * - a drawing one keystroke behind would put the caret in the wrong word.
 */
test('while writing, headings and the signature mark are drawn as what they will be, and the drawing holds exactly what the field holds', async () => {
  const user = userEvent.setup()
  const { container } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  await user.type(box, 'a first line{Enter}{Enter}FIRST HEADING{Enter}a line under it{Enter}SECOND HEADING{Enter}---{Enter}NOT A HEADING HERE')

  const drawing = container.querySelector('.north-editor-mirror') as HTMLElement
  expect(drawing).toHaveAttribute('aria-hidden', 'true')
  expect([...drawing.querySelectorAll('.is-heading')].map(l => l.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])
  expect([...drawing.querySelectorAll('.is-mark')].map(l => l.textContent)).toEqual(['---'])
  const lines = [...drawing.querySelectorAll('.north-editor-line')].map(l => l.textContent)
  expect(lines.join('\n')).toBe((box as HTMLTextAreaElement).value)

  // A heading typed on is a heading no more.
  const value = (box as HTMLTextAreaElement).value
  fireEvent.change(box, { target: { value: value.replace('FIRST HEADING', 'FIRST HEADING and more') } })
  expect([...drawing.querySelectorAll('.is-heading')].map(l => l.textContent)).toEqual(['SECOND HEADING'])
})

// As many headings as the text has: nothing on the page, in the field or on
// the day counts them.
test('a text with forty headings is written, saved and read as forty headings', async () => {
  const text = Array.from({ length: 40 }, (_, i) => `HEADING ${i + 1}\na line under heading ${i + 1}`).join('\n\n')
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  expect(box).not.toHaveAttribute('maxlength')
  await user.click(box)
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().picture?.text).toBe(text)
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(40)
})

// --- reading ------------------------------------------------------------------

/**
 * Reading, since v2.24: the introduction as it was written, then the
 * headings with nothing under them until asked for. A text with no heading
 * is all introduction, and reads whole.
 */
test('a text with no heading reads whole, paragraph by paragraph, with nothing in it to press', () => {
  picture('a first line\na second line\n\na third line\n\n\n\na fourth line')
  const { container } = render(<NorthView />)
  const paragraphs = [...container.querySelectorAll('.north-intro .north-paragraph')].map(p => p.textContent)
  expect(paragraphs).toEqual(['a first line\na second line', 'a third line', 'a fourth line'])
  expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  // Read, not asked anything: no field, no label, and nothing to press but Edit.
  expect(screen.queryByRole('textbox')).toBeNull()
  const read = container.querySelector('.north-read') as HTMLElement
  expect(within(read).getAllByRole('button').map(b => b.textContent)).toEqual(['Edit'])
})

test('in the morning Start the day and Edit stand together at the end of the page, and any look marks the day read', async () => {
  const user = userEvent.setup()
  picture('a line before any heading\n\nFIRST HEADING\na line under it')
  const onStartDay = vi.fn()
  const { container } = render(<NorthView morning onStartDay={onStartDay} />)
  expect(northReadOn()).toBe(TODAY)
  const start = screen.getByRole('button', { name: 'Start the day' })
  const edit = screen.getByRole('button', { name: 'Edit' })
  // One row, past the words: the page has one place for what can be pressed.
  expect(start.parentElement).toBe(edit.parentElement)
  expect(container.querySelector('.north-read')?.lastElementChild).toBe(start.parentElement)
  await user.click(start)
  expect(onStartDay).toHaveBeenCalledTimes(1)
})

test('on an ordinary visit there is no Start the day', () => {
  picture('First line here')
  render(<NorthView />)
  expect(screen.queryByRole('button', { name: 'Start the day' })).toBeNull()
})

// The page with goals but no text is every install from before the text
// existed: the goal at the top, and the one line and the one button under it.
test('a goal from before there was a text stands at the top, over the invitation to write', () => {
  goal('First goal here', { why: 'a reason here' })
  render(<NorthView />)
  expect(screen.getByRole('button', { name: 'Edit "First goal here"' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Write' })).toBeInTheDocument()
  expect(screen.queryByText('a reason here')).toBeNull()
})

// --- headings ------------------------------------------------------------------

/**
 * A line in capitals is a heading and owns everything to the next one -
 * lib/northSections.ts. On the page at rest the introduction shows and the
 * headings stand under it with nothing under them; what a heading holds
 * comes when asked. With a pointer that can rest it comes on the hover,
 * over the page, which is the stylesheet's decision by pointer and the
 * browser test's to walk; a press opens it in the page on any device, and a
 * second press closes it.
 */
test('the introduction stays on the page, the headings stand under it, and a press opens a heading and closes it', async () => {
  const user = userEvent.setup()
  picture('a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second')
  const { container } = render(<NorthView />)
  expect([...container.querySelectorAll('.north-intro .north-paragraph')].map(p => p.textContent)).toEqual(['a line before any heading'])
  expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])

  const toggle = screen.getByRole('button', { name: 'FIRST HEADING' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const body = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  expect([...(body?.querySelectorAll('.north-paragraph') ?? [])].map(p => p.textContent)).toEqual([
    'a line under it',
    'a second paragraph under it',
  ])

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

/**
 * A press that closes a heading leaves the pointer resting on it, and the
 * hover would lay the same words straight back over the page, so the press
 * would look like it had done nothing. A closed heading stays quiet until
 * the pointer leaves it. The stylesheet reads the class, since jsdom has no
 * hover to show the words with.
 */
test('closing a heading with a press keeps its words from coming back under the pointer until the pointer leaves', async () => {
  const user = userEvent.setup()
  picture('FIRST HEADING\na line under it')
  const { container } = render(<NorthView />)
  const toggle = screen.getByRole('button', { name: 'FIRST HEADING' })
  const section = container.querySelector('.north-section') as HTMLElement
  expect(section).toHaveClass('can-preview')

  await user.click(toggle)
  expect(section).not.toHaveClass('can-preview')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(section).not.toHaveClass('can-preview')

  await user.unhover(section)
  expect(section).toHaveClass('can-preview')
})

/**
 * After a line of only --- the rest is the signature: read whole at the foot
 * of the page, past the headings and before the buttons, never under a
 * heading and never one itself.
 */
test('the signature reads whole at the foot of the page, after the headings, and folds under nothing', () => {
  picture('a line before any heading\n\nFIRST HEADING\na line under it\n\n---\nA LINE IN CAPITALS\na signature line\n\na second signature paragraph')
  const { container } = render(<NorthView />)
  const signature = container.querySelector('.north-read .north-signature') as HTMLElement
  expect([...signature.querySelectorAll('.north-paragraph')].map(p => p.textContent)).toEqual([
    'A LINE IN CAPITALS\na signature line',
    'a second signature paragraph',
  ])
  expect(signature.previousElementSibling).toHaveClass('north-sections')
  expect(signature.nextElementSibling).toHaveClass('north-actions')
  expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['FIRST HEADING'])
  expect(container.querySelector('.north-section-body')?.textContent).toBe('a line under it')
})

test('Escape closes an open heading, and a heading with nothing under it is not a control', async () => {
  const user = userEvent.setup()
  picture('FIRST HEADING\na line under it\n\nSECOND HEADING')
  render(<NorthView />)
  const first = screen.getByRole('button', { name: 'FIRST HEADING' })
  await user.click(first)
  expect(first).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(first).toHaveAttribute('aria-expanded', 'false')

  expect(screen.getByRole('heading', { level: 3, name: 'SECOND HEADING' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'SECOND HEADING' })).toBeNull()
})

// --- the goal, at the top ---------------------------------------------------------

/**
 * A goal stands at the top of the page as one quiet line of its own words,
 * and a press on it edits it in place. A title is a goal: the why, the who,
 * the two lists and the rules wait behind More, with the rarer things about
 * goals - archiving, another goal, the archived ones, rules with no goal -
 * at the end of it. Nothing of a goal but its title is on the page.
 */
test('a goal is one quiet line at the top of the page, and nothing else of it is on the page', () => {
  picture('a first line')
  goal('First goal here', { why: 'a reason here', identity: 'a sentence here', deserve: ['a thing I do'] })
  const { container } = render(<NorthView />)
  const head = container.querySelector('.north-view-head') as HTMLElement
  expect(within(head).getByRole('button', { name: 'Edit "First goal here"' })).toHaveTextContent('First goal here')
  expect(screen.queryByText('a reason here')).toBeNull()
  expect(screen.queryByText('a sentence here')).toBeNull()
  expect(screen.queryByText('a thing I do')).toBeNull()
  // No card, no fold, no second way into the goals.
  expect(container.querySelector('article')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Goals' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit goals' })).toBeNull()
})

test('with no goal the top of the page offers one, and a title alone is enough to save it', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Add a goal' }))
  const field = screen.getByRole('textbox', { name: 'Goal' })
  expect(field).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(screen.queryByLabelText('Why it matters')).toBeNull()

  await user.type(field, 'First goal here')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(getData().goals).toHaveLength(1)
  expect(getData().goals[0]).toMatchObject({ title: 'First goal here', createdAt: TODAY })
  expect(getData().goals[0].why).toBeUndefined()
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Edit "First goal here"' })).toHaveFocus()
})

test('a goal is edited in place: Enter saves it, and Escape or Cancel leaves it as it was', async () => {
  const user = userEvent.setup()
  picture('a first line')
  goal('First goal here')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveValue('First goal here')
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), ' and more')
  await user.keyboard('{Escape}')
  expect(getData().goals[0].title).toBe('First goal here')
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), ' and more')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().goals[0].title).toBe('First goal here')

  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.clear(screen.getByRole('textbox', { name: 'Goal' }))
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'A second name here{Enter}')
  expect(getData().goals[0].title).toBe('A second name here')
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull()
})

// Several fields typed one keystroke at a time is the slowest interaction in
// this file, so it has its own timeout - the budget is for hangs, not typing.
test('More opens the rest of a goal with the cursor in it, and Save writes every field', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Add a goal' }))
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'First goal here')
  await user.click(screen.getByRole('button', { name: 'More' }))

  expect(screen.getByLabelText('Why it matters')).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  await user.type(screen.getByLabelText('Why it matters'), 'a reason')
  await user.type(screen.getByLabelText('Who it makes you'), 'a sentence')
  await user.type(screen.getByLabelText('What I do to deserve this'), 'one thing{Enter}two things')
  await user.type(screen.getByLabelText("What I don't do"), 'a thing I skip')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().goals[0]).toMatchObject({
    title: 'First goal here',
    why: 'a reason',
    identity: 'a sentence',
    deserve: ['one thing', 'two things'],
    avoid: ['a thing I skip'],
  })
}, 15_000)

test('a goal that already has more than a title opens with the rest showing', async () => {
  const user = userEvent.setup()
  picture('a first line')
  goal('First goal here', { why: 'a reason here' })
  goal('Second goal here')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  expect(screen.getByLabelText('Why it matters')).toHaveValue('a reason here')
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await user.click(screen.getByRole('button', { name: 'Edit "Second goal here"' }))
  expect(screen.queryByLabelText('Why it matters')).toBeNull()
  expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
})

test('the deserve field stops at four lines rather than trimming a fifth on save', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Add a goal' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  const field = screen.getByLabelText('What I do to deserve this')
  await user.type(field, 'one{Enter}two{Enter}three{Enter}four{Enter}five')
  expect(field).toHaveValue('one\ntwo\nthree\nfourfive')
})

/**
 * A goal's title takes eighty characters, which no one-line box on a phone
 * shows whole, so the box wraps. It is still one line of writing: a line
 * break never reaches a title, and Enter is the way to keep it.
 */
test('a goal title too long for its box wraps, and a line break never reaches it', async () => {
  const user = userEvent.setup()
  picture('a first line')
  goal('First goal here')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  const box = screen.getByRole('textbox', { name: 'Goal' })
  expect(box.tagName).toBe('TEXTAREA')
  await user.clear(box)
  await user.click(box)
  await user.paste('a title with\na line break pasted into it')
  expect(box).toHaveValue('a title with a line break pasted into it')
})

// --- the rarer things, at the end of More -----------------------------------------------

test('Archive puts a goal away at once, and its line goes from the top of the page', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const g = goal('First goal here')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('button', { name: 'Archive this goal' }))

  expect(getData().goals.find(x => x.id === g.id)?.archivedAt).toBe(TODAY)
  expect(screen.queryByRole('button', { name: 'Edit "First goal here"' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Add a goal' })).toBeInTheDocument()
})

test('Add another goal keeps this one and opens a new one, and there is no fifth to add', async () => {
  const user = userEvent.setup()
  picture('a first line')
  goal('First goal here')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.clear(screen.getByRole('textbox', { name: 'Goal' }))
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'One')
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('button', { name: 'Add another goal' }))

  expect(getData().goals.map(g => g.title)).toEqual(['One'])
  expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveFocus()
  for (const title of ['Two', 'Three']) {
    await user.type(screen.getByRole('textbox', { name: 'Goal' }), title)
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Add another goal' }))
  }
  await user.type(screen.getByRole('textbox', { name: 'Goal' }), 'Four')
  await user.click(screen.getByRole('button', { name: 'More' }))
  expect(screen.queryByRole('button', { name: 'Add another goal' })).toBeNull()
  expect(screen.getByText(`${MAX_ACTIVE_GOALS} is the limit - archive one to make room.`)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(activeGoals(getData().goals).map(g => g.title)).toEqual(['One', 'Two', 'Three', 'Four'])
}, 15_000)

test('archived goals are brought back or deleted from a fold at the end of More', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const old = goal('An older goal')
  goal('First goal here')
  actions.archiveGoal(old.id, TODAY)
  render(<NorthView />)

  expect(screen.queryByText(/Archived \(1\)/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  await user.click(screen.getByRole('button', { name: 'Bring back' }))
  expect(getData().goals.find(x => x.id === old.id)?.archivedAt).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Edit "An older goal"' })).toBeInTheDocument()

  act(() => actions.archiveGoal(old.id, TODAY))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(getData().goals.find(x => x.id === old.id)).toBeUndefined()
})

test('bringing one back is refused while there are four goals', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const old = goal('An older goal')
  actions.archiveGoal(old.id, TODAY)
  for (let i = 0; i < MAX_ACTIVE_GOALS; i++) goal(`Goal ${i}`)
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "Goal 0"' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('button', { name: 'Archived (1)' }))
  expect(screen.getByRole('button', { name: 'Bring back' })).toBeDisabled()
})

// --- what pulls you off a goal, behind More ------------------------------------------

/**
 * The rules are written where the rest of a goal is written - GoalRules.tsx -
 * and act at once rather than on Save, because a rule is its own entity with
 * its own id. The cap refuses rather than evicting, so it is said.
 */
test('a rule is written behind More and belongs to the goal it was written under', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const first = goal('First goal here')
  goal('Second goal here')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  await user.click(screen.getByRole('button', { name: 'What pulls me off "First goal here"' }))
  expect(screen.getByText(/Name one moment that takes you off this .* and the one thing you do instead./)).toBeInTheDocument()
  await user.type(screen.getByLabelText('If'), 'a moment here')
  await user.type(screen.getByLabelText('Then'), 'a thing to do instead{Enter}')

  expect(getData().ifThens).toHaveLength(1)
  expect(getData().ifThens[0].goalId).toBe(first.id)
  // Nothing of it on the page once the goal is closed.
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText(/a moment here/)).toBeNull()
})

test('a goal with five rules offers no way to write a sixth, and says why', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const g = goal('First goal here')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  expect(screen.queryByRole('button', { name: /^Add another to/ })).toBeNull()
  expect(screen.getByText(`${MAX_RULES_PER_GOAL} is the limit - delete one to make room.`)).toBeTruthy()
})

test('deleting a rule takes two presses, and editing one rewrites it in place', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const g = goal('First goal here')
  actions.addIfThen({ trigger: 'Old trigger', action: 'Old action', goalId: g.id })
  actions.addIfThen({ trigger: 'A moment', action: 'A thing', goalId: g.id })
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))

  await user.click(screen.getByRole('button', { name: 'Edit "Old trigger"' }))
  await user.clear(screen.getByLabelText('If'))
  await user.type(screen.getByLabelText('If'), 'New trigger{Enter}')
  expect(getData().ifThens.map(r => r.trigger)).toEqual(['New trigger', 'A moment'])

  await user.click(screen.getByRole('button', { name: 'Delete "A moment"' }))
  expect(getData().ifThens).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'Confirm delete "A moment"' }))
  expect(getData().ifThens.map(r => r.trigger)).toEqual(['New trigger'])
})

/**
 * A rule with no goal - written before rules had goals, or left behind when
 * its goal was deleted, on purpose - waits at the end of More to be filed.
 * An archived goal keeps its own, and a full goal is offered but refused.
 */
test('rules with no goal wait at the end of More, and one press files one', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const kept = goal('First goal here')
  const gone = goal('A goal on its way out')
  actions.addIfThen({ trigger: 'a moment with no goal', action: 'a thing', goalId: gone.id })
  actions.deleteGoal(gone.id)
  const archived = goal('An archived goal')
  actions.addIfThen({ trigger: 'an archived goal keeps this', action: 'a thing', goalId: archived.id })
  actions.archiveGoal(archived.id, TODAY)
  render(<NorthView />)

  expect(screen.queryByText(/a moment with no goal/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  await user.click(screen.getByRole('button', { name: 'More' }))
  const waiting = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(waiting).getByText(/a moment with no goal/)).toBeInTheDocument()
  expect(within(waiting).queryByText(/an archived goal keeps this/)).toBeNull()

  await user.click(within(waiting).getByRole('button', { name: 'First goal here' }))
  expect(getData().ifThens.find(r => r.trigger === 'a moment with no goal')?.goalId).toBe(kept.id)
  expect(screen.queryByRole('region', { name: 'Rules with no goal' })).toBeNull()
})

test('a full goal is offered but refused for a rule with no goal, so nothing looks broken when pressed', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const g = goal('First goal here')
  for (let i = 0; i < MAX_RULES_PER_GOAL; i++) {
    actions.addIfThen({ trigger: `Trigger ${i}`, action: `Action ${i}`, goalId: g.id })
  }
  actions.addIfThen({ trigger: 'Waiting', action: 'For room' })
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  const waiting = screen.getByRole('region', { name: 'Rules with no goal' })
  expect(within(waiting).getByRole('button', { name: 'First goal here' })).toBeDisabled()
})

// --- what the page never does ----------------------------------------------------------

/**
 * Nothing on this screen measures anything - ARCHITECTURE section 6 - and
 * nothing on it is a number: not a count, not an age, not a digit.
 */
test('nothing on the page is a number, with a goal open and everything in it showing', async () => {
  const user = userEvent.setup()
  const g = actions.addGoal({ title: 'First goal here', why: 'a reason here', deserve: ['a thing I do'] }, '2026-09-01')!
  actions.addIfThen({ trigger: 'a moment here', action: 'a thing to do', goalId: g.id })
  picture('a first line\n\nFIRST HEADING\na line under it\n---\na signature line')
  const { container } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))

  expect(screen.queryByText(/lived toward this/)).toBeNull()
  expect(container.querySelector('progress, meter, input[type="checkbox"]')).toBeNull()
  expect(container.textContent).not.toMatch(/%|\b1 of \b|complete|streak/i)
  expect(container.textContent).not.toMatch(/\d/)
})

/**
 * The page is one person's own writing, so it is written in one voice: the
 * app never narrates its owner in the third person, in a label or anywhere
 * else, with every part of a goal open at once.
 */
test('nothing on the page talks about its owner in the third person', async () => {
  const user = userEvent.setup()
  picture('a first line')
  goal('First goal here', { why: 'a reason here', identity: 'a sentence here', deserve: ['a thing I do'], avoid: ['a thing I skip'] })
  const { container } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit "First goal here"' }))
  expect(container.textContent).not.toMatch(/\b(he|his|him|she|hers)\b/i)
})

/**
 * The goal stays an approach goal and the away half is a contrast inside it
 * (docs/RESEARCH-NORTH.md section 5), so nothing the day carries reads it:
 * the Monday card takes its line from what is done, never from what is not.
 */
test('nothing the day carries reads the away half', () => {
  goal('First goal here', { deserve: ['a thing I do'], avoid: ['a thing I skip'] })
  const [written] = getData().goals
  expect(written.avoid).toEqual(['a thing I skip'])
  expect(deserveForWeek(written, '2026-08-31')).toBe('a thing I do')
})

