import { beforeEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { activeGoals, deserveForWeek } from '../../lib/north'
import { MAX_ACTIVE_GOALS, MAX_RULES_PER_GOAL } from '../../lib/types'

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

/** A rule's body in the stylesheet, by its selector exactly as written there. */
function cssRule(selector: string): string {
  const css = readFileSync(join(__dirname, '../../styles.css'), 'utf8').replace(/\r\n/g, '\n')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp('\\n' + escaped + ' \\{([^}]*)\\}'))?.[1] ?? ''
}

/** A space declared in steps of the scale, in pixels: var(--s8), or a calc of steps added. */
function spacePx(body: string, property: string): number {
  const value = body.match(new RegExp('(?:^|\\n)\\s*' + property + ':\\s*([^;]+);'))?.[1] ?? ''
  const steps: Record<string, number> = { s1: 4, s2: 8, s3: 12, s4: 16, s6: 24, s8: 32, s12: 48 }
  const found = [...value.matchAll(/--(s\d+)/g)]
  return found.length ? found.reduce((sum, m) => sum + (steps[m[1]] ?? NaN), 0) : NaN
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

test('Write opens the field with the rule said once under it, and nothing to save until something is typed', async () => {
  const user = userEvent.setup()
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  expect(box).toHaveFocus()
  // One calm line in sentence case, under the field rather than over it.
  const rule = 'Capital lines become headings. A line of --- starts your signature.'
  expect(box).toHaveAccessibleDescription(rule)
  expect(screen.getAllByText(rule)).toHaveLength(1)
  expect(box.compareDocumentPosition(screen.getByText(rule)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  // The empty field asks one thing, and shows nobody's words.
  expect(box).toHaveAttribute('placeholder', 'Write who you are.')
  // Cancel beside Save and before it, Save last, and nothing to save yet.
  expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['Cancel', 'Save'])
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

/**
 * The two keys the brief asks for: Ctrl or Cmd with Enter is Save, and
 * Escape is Cancel. Enter alone is a new line, as it always was.
 */
test('Ctrl and Enter or Cmd and Enter save the text as typed, and Escape drops what was typed', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)

  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), '{Enter}a second line')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(getData().picture?.text).toBe('a first line\na second line')
  expect(screen.queryByRole('textbox', { name: 'North' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), '{Enter}a third line')
  await user.keyboard('{Meta>}{Enter}{/Meta}')
  expect(getData().picture?.text).toBe('a first line\na second line\na third line')

  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.type(screen.getByRole('textbox', { name: 'North' }), '{Enter}a line nobody keeps')
  await user.keyboard('{Escape}')
  expect(getData().picture?.text).toBe('a first line\na second line\na third line')
  expect(screen.queryByRole('textbox', { name: 'North' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
})

/**
 * Save never looks broken: on a kept text it waits, out of sight, until
 * something is different, and Cancel is always there. With nothing changed,
 * Ctrl and Enter simply closes the field - there is nothing to lose.
 */
test('on a kept text Save waits for a change, and Ctrl and Enter with nothing changed closes the field', async () => {
  const user = userEvent.setup()
  picture('a first line')
  render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()

  const box = screen.getByRole('textbox', { name: 'North' })
  await user.type(box, '!')
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  await user.keyboard('{Backspace}')
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(screen.queryByRole('textbox', { name: 'North' })).toBeNull()
  expect(getData().picture?.text).toBe('a first line')
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
  // The signature's lines, after the mark, are drawn quieter - and capitals
  // there are not a heading.
  expect([...drawing.querySelectorAll('.is-signature')].map(l => l.textContent)).toEqual(['NOT A HEADING HERE'])
  const lines = [...drawing.querySelectorAll('.north-editor-line')].map(l => l.textContent)
  expect(lines.join('\n')).toBe((box as HTMLTextAreaElement).value)

  // A heading typed on is a heading no more.
  const value = (box as HTMLTextAreaElement).value
  fireEvent.change(box, { target: { value: value.replace('FIRST HEADING', 'FIRST HEADING and more') } })
  expect([...drawing.querySelectorAll('.is-heading')].map(l => l.textContent)).toEqual(['SECOND HEADING'])
})

/**
 * A heading's [morning] or [evening] is only ever seen in the field, where
 * it is written, and the drawing sets it apart from the heading's words: in
 * a quieter span of its own, the spaces before it included, so the line
 * still holds exactly what the field holds. Words in brackets on a line of
 * text are words.
 */
test("while writing, a heading's tag is drawn apart from its words, and brackets on a line of text are not", async () => {
  const user = userEvent.setup()
  const { container } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Write' }))
  const box = screen.getByRole('textbox', { name: 'North' })
  fireEvent.change(box, { target: { value: 'FIRST HEADING [morning]\na line under it [evening]\nSECOND HEADING' } })

  const drawing = container.querySelector('.north-editor-mirror') as HTMLElement
  expect([...drawing.querySelectorAll('.north-editor-tag')].map(t => t.textContent)).toEqual([' [morning]'])
  expect(drawing.querySelector('.north-editor-tag')?.parentElement).toHaveClass('is-heading')
  const lines = [...drawing.querySelectorAll('.north-editor-line')].map(l => l.textContent)
  expect(lines.join('\n')).toBe((box as HTMLTextAreaElement).value)
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
 * headings, then the signature. A text with no heading is all introduction,
 * and reads whole. Since v2.26 nothing in the words is a control: the page is
 * for reading, and Edit stands at the right of its name.
 */
test('a text with no heading reads whole, paragraph by paragraph, with nothing in it to press', () => {
  picture('a first line\na second line\n\na third line\n\n\n\na fourth line')
  const { container } = render(<NorthView />)
  const paragraphs = [...container.querySelectorAll('.north-intro .north-paragraph')].map(p => p.textContent)
  expect(paragraphs).toEqual(['a first line\na second line', 'a third line', 'a fourth line'])
  expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  // Read, not asked anything: no field, no label, and nothing to press.
  expect(screen.queryByRole('textbox')).toBeNull()
  const read = container.querySelector('.north-read') as HTMLElement
  expect(within(read).queryAllByRole('button')).toEqual([])
})

// Edit is the page's action, and a page's action stands at the right of its
// name (docs/DESIGN.md, the frame) - not after the last line, where a long
// text put it a scroll away. The morning's Start the day went with the
// morning's page opening, in v2.24.
test("Edit stands at the right of the page's name, not after the words, and there is no Start the day", () => {
  picture('a line before any heading\n\nFIRST HEADING\na line under it\n---\na signature line')
  const { container } = render(<NorthView />)
  const edit = screen.getByRole('button', { name: 'Edit' })
  const title = container.querySelector('.north-view-head > .north-view-title') as HTMLElement
  expect(edit.parentElement).toBe(title)
  expect(title.firstElementChild?.tagName).toBe('H2')
  expect(title.lastElementChild).toBe(edit)
  expect(container.querySelector('.north-read')?.lastElementChild).toHaveClass('north-signature')
  expect(screen.queryByRole('button', { name: 'Start the day' })).toBeNull()
})

// The row Edit stands in is kept while the field is open, one control tall
// whether Edit is drawn or not, so nothing under it moves when it goes.
test('while the field is open Edit is gone and its row is kept, and an empty page has no Edit', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const { container, unmount } = render(<NorthView />)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  expect(container.querySelector('.north-view-head > .north-view-title > h2')).not.toBeNull()
  expect(cssRule('.north-view-title')).toMatch(/min-height:\s*var\(--control-h\)/)
  unmount()

  actions.setPicture('')
  render(<NorthView />)
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
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
 * lib/northSections.ts. Since v2.26 the page shows all of it at once, with
 * nothing to press and nothing behind a pointer: the introduction, every
 * heading with every paragraph under it, and the signature. A heading with
 * nothing under it is a heading all the same. The day beside the page is
 * where a heading's lines come on a hover or a tap (NorthDay).
 */
test('everything is on the page without a press: the introduction, every heading with its lines, and the signature', () => {
  picture('a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\nTHIRD HEADING\na line under the third\n---\na signature line')
  const { container } = render(<NorthView />)
  expect([...container.querySelectorAll('.north-intro .north-paragraph')].map(p => p.textContent)).toEqual(['a line before any heading'])
  const sections = [...container.querySelectorAll('.north-sections > .north-section')].map(section => [
    section.querySelector('h3')?.textContent,
    ...[...section.querySelectorAll('.north-paragraph')].map(p => p.textContent),
  ])
  expect(sections).toEqual([
    ['FIRST HEADING', 'a line under it', 'a second paragraph under it'],
    ['SECOND HEADING'],
    ['THIRD HEADING', 'a line under the third'],
  ])
  expect(screen.getByText('a signature line')).toBeInTheDocument()
  // Nothing folds: no control in the words, nothing expanded or collapsed.
  const read = container.querySelector('.north-read') as HTMLElement
  expect(within(read).queryAllByRole('button')).toEqual([])
  expect(read.querySelector('[aria-expanded], [hidden]')).toBeNull()
})

// The tag says when a heading's lines belong on the day; on the page it is
// never drawn.
test("a heading's [morning] or [evening] is never drawn on the page", () => {
  picture('FIRST HEADING [morning]\na line under it\nSECOND HEADING [Evening]\na line under the second')
  const { container } = render(<NorthView />)
  expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['FIRST HEADING', 'SECOND HEADING'])
  expect(container.querySelector('.north-read')?.textContent).not.toMatch(/morning|evening/i)
})

/**
 * The page's type, read from the stylesheet since jsdom has no layout: a
 * heading a step larger and heavier than the words and written as typed,
 * with more air over it than under it; the signature a step larger than the
 * words, with more air over it than a heading has; and the column at the
 * reading width.
 */
test('a heading is a step over the words with more air over it than under it, and the signature has the most air over it', () => {
  const heading = cssRule('.north-heading')
  expect(heading).toMatch(/font-size:\s*var\(--t-lg\)/)
  expect(heading).toMatch(/font-weight:\s*var\(--w-strong\)/)
  expect(heading).not.toMatch(/letter-spacing|text-transform/)
  // margin: 0 0 var(--s2) - the one step in it is the air under the heading.
  const under = spacePx(heading, 'margin')
  const over = spacePx(cssRule('.north-sections'), 'gap')
  expect(spacePx(cssRule('.north-intro + .north-sections'), 'margin-top')).toBe(over)
  expect(under).toBeGreaterThan(0)
  expect(over).toBeGreaterThan(under * 2)

  expect(cssRule('.north-read .north-signature > .north-paragraph')).toMatch(/font-size:\s*var\(--t-lg\)/)
  expect(spacePx(cssRule('.north-signature'), 'margin-top')).toBeGreaterThan(over)
  expect(cssRule('.north-view')).toMatch(/max-width:\s*var\(--read-w\)/)
})

/**
 * After a line of only --- the rest is the signature: read whole at the foot
 * of the page, past the headings, never under a heading and never one
 * itself.
 */
test('the signature reads whole at the foot of the page, after the headings', () => {
  picture('a line before any heading\n\nFIRST HEADING\na line under it\n\n---\nA LINE IN CAPITALS\na signature line\n\na second signature paragraph')
  const { container } = render(<NorthView />)
  const signature = container.querySelector('.north-read .north-signature') as HTMLElement
  expect([...signature.querySelectorAll('.north-paragraph')].map(p => p.textContent)).toEqual([
    'A LINE IN CAPITALS\na signature line',
    'a second signature paragraph',
  ])
  expect(signature.previousElementSibling).toHaveClass('north-sections')
  expect(signature.nextElementSibling).toBeNull()
  expect(screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(['FIRST HEADING'])
  expect(container.querySelector('.north-section .north-paragraph')?.textContent).toBe('a line under it')
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

