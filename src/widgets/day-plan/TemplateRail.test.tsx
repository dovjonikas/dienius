import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateRail } from './TemplateRail'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { getUndo, resetUndoForTests } from '../../lib/undo'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  resetUndoForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

const WORK_BLOCKS = [
  { title: 'Deep work', time: '09:00' },
  { title: 'Lunch', time: '12:00' },
]

function titlesOn(date: string) {
  return (getData().days[date]?.tasks ?? []).map(t => t.title)
}

test('renders nothing when there are no templates yet', () => {
  const { container } = render(<TemplateRail date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

// The template's colour arrives as a custom property rather than as the
// chip's own background: it paints a dot now, not the whole pill. See the
// .template-chip block in styles.css for why.
test('renders one chip per template, coloured and named', () => {
  actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  render(<TemplateRail date={DATE} />)
  const work = screen.getByRole('button', { name: 'Work day' })
  const rest = screen.getByRole('button', { name: 'Rest day' })
  expect(work.style.getPropertyValue('--chip')).toBe('#8ab6f9')
  expect(rest.style.getPropertyValue('--chip')).toBe('#cde39e')
})

test('the currently-stamped template renders selected; the rest do not', () => {
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  expect(screen.getByRole('button', { name: 'Work day' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Rest day' })).toHaveAttribute('aria-pressed', 'false')
})

/**
 * What a press does depends on what the day already carries - the rule at
 * the top of TemplateRail.tsx. A day with no template is stamped at once;
 * the template already on the day is left alone and the rail says so; a
 * different one asks before it replaces anything. The calendar's own stamp
 * doors are not part of this and stamp as they always did.
 */
test('an empty day is stamped at once, onto the day currently open', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
  expect(getUndo()?.label).toBe('Stamped Work day')
})

test('a day with tasks by hand and no template is stamped at once too, and keeps them', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  actions.addTask(DATE, 'Call the bank')
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
  expect(titlesOn(DATE)).toEqual(expect.arrayContaining(['Call the bank', 'Deep work', 'Lunch']))
  expect(screen.queryByRole('status')).toBeNull()
})

test('pressing the chip of the template already on the day changes nothing and says so', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  actions.stamp({ [DATE]: work.id })
  const before = getData().days[DATE]
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  // The same object, not an equal one: nothing was committed at all.
  expect(getData().days[DATE]).toBe(before)
  expect(getUndo()).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Already on this day')
})

// fireEvent rather than userEvent under fake timers, for the reason
// QuickAdd.test.tsx gives: a user event waits on timers that never run.
test('the quiet line goes on its own after three seconds', () => {
  vi.useFakeTimers()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  fireEvent.click(screen.getByRole('button', { name: 'Work day' }))
  expect(screen.getByRole('status')).toHaveTextContent('Already on this day')
  act(() => {
    vi.advanceTimersByTime(2999)
  })
  expect(screen.getByRole('status')).toHaveTextContent('Already on this day')
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(screen.queryByRole('status')).toBeNull()
})

test('the quiet line goes at once on the next press, which gets its own answer', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(screen.getByRole('status')).toHaveTextContent('Already on this day')
  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Replace Work day with Rest day?')
})

test('pressing another template asks before replacing, and a block added by hand stays', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  const rest = actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [{ title: 'Walk', time: '10:00' }] })
  actions.stamp({ [DATE]: work.id })
  actions.addTask(DATE, 'Call the bank')
  render(<TemplateRail date={DATE} />)

  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
  expect(getUndo()).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent(
    'Replace Work day with Rest day? Blocks you added by hand stay.',
  )

  await user.click(screen.getByRole('button', { name: 'Replace' }))
  expect(getData().days[DATE]?.templateId).toBe(rest.id)
  expect(titlesOn(DATE)).toContain('Call the bank')
  expect(titlesOn(DATE)).toContain('Walk')
  expect(titlesOn(DATE)).not.toContain('Deep work')
  expect(getUndo()?.label).toBe('Stamped Rest day')
  expect(screen.queryByRole('status')).toBeNull()
})

test('Cancel leaves the day as it was', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  const before = getData().days[DATE]
  render(<TemplateRail date={DATE} />)

  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(getData().days[DATE]).toBe(before)
  expect(getUndo()).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
})

test('the question clears when the open day changes', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  const { rerender } = render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  expect(screen.getByRole('status')).toBeInTheDocument()
  rerender(<TemplateRail date="2026-09-02" />)
  expect(screen.queryByRole('status')).toBeNull()
})

// CONVENTIONS section 12 rule 11: twice is once. The second press is the
// "already on this day" case and commits nothing, so nothing can double.
test('twice is once: pressing one chip twice leaves one copy of every block', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(titlesOn(DATE).sort()).toEqual(['Deep work', 'Lunch'])
})

// A template can be deleted after it stamped a day. Everything else reads
// the dangling id as no template, and that is right for a score or a colour;
// for the rail it is not, because the blocks the template left are still on
// the day and a stamp over them takes every one. The question is asked under
// a name that says what happened.
test("a day still carrying a deleted template's blocks asks before it is stamped over", async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  const rest = actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  actions.deleteTemplate(work.id)
  expect(titlesOn(DATE)).toEqual(['Deep work', 'Lunch'])
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  expect(screen.getByRole('status')).toHaveTextContent(
    'Replace a template that is gone with Rest day? Blocks you added by hand stay.',
  )
  expect(titlesOn(DATE)).toEqual(['Deep work', 'Lunch'])
  expect(getData().days[DATE]?.templateId).toBe(work.id)
  await user.click(screen.getByRole('button', { name: 'Replace' }))
  expect(getData().days[DATE]?.templateId).toBe(rest.id)
  expect(titlesOn(DATE)).toEqual([])
})

// Replace and Cancel unmount themselves on the press. Focus goes back to the
// chip that raised the question, so a keyboard is where it was and not on
// the body - the same promise every sheet keeps through useRestoreFocus.
test('closing the question, either way, puts focus back on the chip that raised it', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: WORK_BLOCKS })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  const restChip = screen.getByRole('button', { name: 'Rest day' })
  await user.click(restChip)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(document.activeElement).toBe(restChip)
  await user.click(restChip)
  await user.click(screen.getByRole('button', { name: 'Replace' }))
  expect(document.activeElement).toBe(restChip)
})
