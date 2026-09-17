import { beforeEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NorthView } from './NorthView'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const TODAY = '2026-09-05'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00`))
})

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
 * North, since v2.24: one page, one column. The text - the introduction, the
 * headings and the signature - and one field for writing it; since v2.28
 * nothing else, goals being retired. Every line in these tests is a generic
 * one: the app carries nobody's words and neither does this file.
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

/**
 * Goals are retired, v2.28: a plan that comes in with them has their titles
 * and whys moved into its text on the way in (retireGoals in lib/north.ts),
 * and the page itself shows no goal and offers none - even for a plan held
 * in memory that still has one active.
 */
test('a plan that still holds goals shows none of them, and nothing on the page offers one', () => {
  actions.resetForTests({
    ...defaultData(),
    goals: [{ id: 'g1', title: 'First goal here', why: 'a reason here', deserve: ['a thing I do'], createdAt: '2026-09-01' }],
    ifThens: [{ id: 'r1', trigger: 'a moment here', action: 'a thing to do', goalId: 'g1' }],
    picture: { text: 'a first line\n\nFIRST HEADING\na line under it\n---\na signature line' },
  })
  const { container } = render(<NorthView />)
  expect(container.textContent).not.toMatch(/goal|First goal here|a reason here|a thing I do|a moment here/i)
  expect(screen.queryByRole('button', { name: /goal/i })).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
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

// --- what the page never does ----------------------------------------------------------

/**
 * Nothing on this screen measures anything - ARCHITECTURE section 6 - and
 * nothing on it is a number: not a count, not an age, not a digit.
 */
test('nothing on the page is a number, with every part of the text showing', () => {
  picture('a first line\n\nFIRST HEADING\na line under it\n---\na signature line')
  const { container } = render(<NorthView />)

  expect(screen.queryByText(/lived toward this/)).toBeNull()
  expect(container.querySelector('progress, meter, input[type="checkbox"]')).toBeNull()
  expect(container.textContent).not.toMatch(/%|\b1 of \b|complete|streak/i)
  expect(container.textContent).not.toMatch(/\d/)
})

/**
 * The page is one person's own writing, so it is written in one voice: the
 * app never narrates its owner in the third person, in a label or anywhere
 * else, reading or writing.
 */
test('nothing on the page talks about its owner in the third person', async () => {
  const user = userEvent.setup()
  picture('a first line')
  const { container } = render(<NorthView />)
  expect(container.textContent).not.toMatch(/\b(he|his|him|she|hers)\b/i)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  expect(container.textContent).not.toMatch(/\b(he|his|him|she|hers)\b/i)
})
