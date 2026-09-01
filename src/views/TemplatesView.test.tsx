import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesView } from './TemplatesView'
import { actions, getData } from '../lib/store'
import { defaultData } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('opening the new-template form moves focus into the name field', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  expect(screen.getByPlaceholderText('Template name')).toHaveFocus()
})

test('opening an existing template for editing moves focus into the name field', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Morning', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  expect(screen.getByPlaceholderText('Template name')).toHaveFocus()
})

test('creates a template with a block', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Work day')
  expect(saved[0].blocks[0]).toMatchObject({ time: '09:00', title: 'Gym' })
})

test('deleting a template requires a confirming second tap', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(getData().templates).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Confirm delete Old' }))
  expect(getData().templates).toHaveLength(0)
})

test('the delete confirmation resets when focus moves elsewhere', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Delete Old' }))
  expect(screen.getByRole('button', { name: 'Confirm delete Old' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Edit Old' }))
  expect(getData().templates).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('button', { name: 'Delete Old' })).toBeInTheDocument()
})

test('editing an existing template and saving updates it in place', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Morning',
    color: '#f9d48a',
    blocks: [{ time: '08:00', title: 'Wake up' }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  const nameInput = screen.getByPlaceholderText('Template name')
  await user.clear(nameInput)
  await user.type(nameInput, 'Weekday morning')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Weekday morning')
  expect(saved[0].blocks[0]).toMatchObject({ time: '08:00', title: 'Wake up' })
})

test('cancel discards the draft without touching stored data', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Old' }))
  const nameInput = screen.getByPlaceholderText('Template name')
  await user.clear(nameInput)
  await user.type(nameInput, 'Changed but not saved')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].name).toBe('Old')
})

test('removing a block from a draft leaves it out of the saved template', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.type(screen.getByPlaceholderText('09:00'), '13:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Lunch')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Remove Gym' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  const saved = getData().templates
  expect(saved).toHaveLength(1)
  expect(saved[0].blocks).toHaveLength(1)
  expect(saved[0].blocks[0]).toMatchObject({ time: '13:00', title: 'Lunch' })
})

test('a new template defaults to full day and saves that type explicitly', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Ordinary day')
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].type).toBe('full')
})

test('the core toggle is not shown on a full-day template, so a block cannot be marked core there', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  expect(screen.queryByRole('button', { name: /mark new block as core/i })).not.toBeInTheDocument()
})

test('the ongoing toggle is shown on a full-day template too, unlike core - it has nothing to do with day type', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Standing item')
  expect(screen.getByRole('button', { name: /mark new block as ongoing/i })).toBeInTheDocument()
})

test('marking a new block ongoing saves that way, and an untouched block saves as bounded', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Ongoing project')
  await user.type(screen.getByPlaceholderText('What happens'), 'Standing item')
  await user.click(screen.getByRole('button', { name: /mark new block as ongoing/i }))
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Ordinary item')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.blocks.find(b => b.title === 'Standing item')?.unbounded).toBe(true)
  expect(saved.blocks.find(b => b.title === 'Ordinary item')?.unbounded).toBeFalsy()
})

test('editing a template loads each block\'s ongoing state', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Ongoing project',
    color: '#c9b3f0',
    blocks: [{ time: '19:00', title: 'Standing item', unbounded: true }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Ongoing project' }))
  expect(screen.getByRole('button', { name: 'Standing item is ongoing' })).toBeInTheDocument()
})

test('picking a day type reveals the core toggle, and a block marked core saves that way', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Night shift')
  await user.click(screen.getByRole('button', { name: 'Shift' }))
  await user.type(screen.getByPlaceholderText('09:00'), '19:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Clock in')
  await user.click(screen.getByRole('button', { name: /mark new block as core/i }))
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Snack')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.type).toBe('shift')
  expect(saved.blocks.find(b => b.title === 'Clock in')?.core).toBe(true)
  expect(saved.blocks.find(b => b.title === 'Snack')?.core).toBeFalsy()
})

test('editing a shift template loads its type and each block\'s core state', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'Clock in', core: true }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Night shift' }))
  expect(screen.getByRole('button', { name: 'Shift' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Clock in is core' })).toBeInTheDocument()
})

test('switching a template from shift back to full hides the core toggles without losing the data underneath', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ time: '19:00', title: 'Clock in', core: true }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Night shift' }))
  await user.click(screen.getByRole('button', { name: 'Full day' }))
  expect(screen.queryByRole('button', { name: 'Clock in is core' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].type).toBe('full')
  // The block itself, and its core flag, are untouched by the type switch.
  expect(getData().templates[0].blocks[0]).toMatchObject({ title: 'Clock in', core: true })
})

test('editing a template keeps each surviving block\'s id and mints a fresh one only for a block added during the edit', async () => {
  const user = userEvent.setup()
  const created = actions.addTemplate({
    name: 'Morning',
    color: '#f9d48a',
    blocks: [
      { time: '08:00', title: 'Wake up' },
      { time: '08:30', title: 'Shower' },
    ],
  })
  const [wakeId, showerId] = created.blocks.map(b => b.id)

  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Commute')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))

  const saved = getData().templates[0]
  expect(saved.blocks.find(b => b.title === 'Wake up')?.id).toBe(wakeId)
  expect(saved.blocks.find(b => b.title === 'Shower')?.id).toBe(showerId)
  const commuteId = saved.blocks.find(b => b.title === 'Commute')?.id
  expect(commuteId).toBeTruthy()
  expect([wakeId, showerId]).not.toContain(commuteId)
})

test('a block saved with a size carries it, so a stamped day arrives already sized', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Full day')
  await user.type(screen.getByPlaceholderText('09:00'), '09:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.type(screen.getByPlaceholderText('min'), '90')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0]).toMatchObject({ title: 'Gym', minutes: 90 })
})

test('a block added with no size saves with minutes absent, not zero', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Full day')
  await user.type(screen.getByPlaceholderText('What happens'), 'Guitar')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].minutes).toBeUndefined()
})

test('editing an existing sized template loads its blocks with their sizes intact', async () => {
  const user = userEvent.setup()
  actions.addTemplate({
    name: 'Morning',
    color: '#f9d48a',
    blocks: [{ time: '08:00', title: 'Wake up', minutes: 15 }],
  })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Morning' }))
  expect(screen.getByText('15 min')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].minutes).toBe(15)
})

test('typing garbage into the block size field saves it as unsized rather than a bad number', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Full day')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.type(screen.getByPlaceholderText('min'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].minutes).toBeUndefined()
})

test('typing a time in a bare-digit shorthand normalises it before the block is added', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '0930')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0]).toMatchObject({ time: '09:30', title: 'Gym' })
})

test('typing garbage into the block time field is discarded, and the block is added as a float', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), 'banana')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].time).toBeUndefined()
})

test('an out-of-range time like 25:00 is discarded the same way plain garbage is', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('09:00'), '25:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].time).toBeUndefined()
})

test('clearing an already-typed time leaves the block a float, not an error', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  const timeField = screen.getByPlaceholderText('09:00')
  await user.type(timeField, '09:00')
  await user.clear(timeField)
  await user.type(screen.getByPlaceholderText('What happens'), 'Guitar')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0].time).toBeUndefined()
})

test('the arrow keys step the block time by 15 minutes, seeding an empty field on the first press', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  const timeField = screen.getByPlaceholderText('09:00')
  timeField.focus()
  await user.keyboard('{ArrowUp}')
  expect(timeField).toHaveValue('09:00')
  await user.keyboard('{ArrowUp}')
  expect(timeField).toHaveValue('09:15')
  await user.keyboard('{ArrowDown}')
  expect(timeField).toHaveValue('09:00')
})

test('the arrow keys step across an hour boundary and, with Shift held, by a full hour', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  const timeField = screen.getByPlaceholderText('09:00')
  await user.type(timeField, '09:50')
  timeField.focus()
  await user.keyboard('{ArrowUp}')
  expect(timeField).toHaveValue('10:05')
  await user.keyboard('{Shift>}{ArrowUp}{/Shift}')
  expect(timeField).toHaveValue('11:05')
})

test('the arrow keys wrap across midnight in both directions', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  const timeField = screen.getByPlaceholderText('09:00')
  await user.type(timeField, '23:50')
  timeField.focus()
  await user.keyboard('{ArrowUp}')
  expect(timeField).toHaveValue('00:05')
  await user.keyboard('{ArrowDown}')
  expect(timeField).toHaveValue('23:50')
})

test('the step buttons beside the field move the time the same way the arrow keys do', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  const timeField = screen.getByPlaceholderText('09:00')
  await user.click(screen.getByRole('button', { name: 'Block time: move 15 minutes later' }))
  expect(timeField).toHaveValue('09:00')
  await user.click(screen.getByRole('button', { name: 'Block time: move 15 minutes later' }))
  expect(timeField).toHaveValue('09:15')
  await user.click(screen.getByRole('button', { name: 'Block time: move 15 minutes earlier' }))
  expect(timeField).toHaveValue('09:00')
})

test('a time committed straight to the block-add row is used even without leaving the field first', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('Template name'), 'Work day')
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  const timeField = screen.getByPlaceholderText('09:00')
  await user.type(timeField, '0930')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  await user.click(screen.getByRole('button', { name: 'Save template' }))
  expect(getData().templates[0].blocks[0]).toMatchObject({ time: '09:30', title: 'Gym' })
})

test('garbage typed into the block size field never shows as a bad number in the live preview', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'New template' }))
  await user.type(screen.getByPlaceholderText('What happens'), 'Gym')
  await user.type(screen.getByPlaceholderText('min'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Add block' }))
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
})

test('block-add fields do not leak between editing sessions', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'A', color: '#f9d48a', blocks: [] })
  actions.addTemplate({ name: 'B', color: '#a7c4f5', blocks: [] })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit A' }))
  await user.type(screen.getByPlaceholderText('09:00'), '10:00')
  await user.type(screen.getByPlaceholderText('What happens'), 'Half-typed')
  await user.type(screen.getByPlaceholderText('min'), '20')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await user.click(screen.getByRole('button', { name: 'Edit B' }))
  expect(screen.getByPlaceholderText('09:00')).toHaveValue('')
  expect(screen.getByPlaceholderText('What happens')).toHaveValue('')
  expect(screen.getByPlaceholderText('min')).toHaveValue('')
})

test('with no templates saved, the empty state offers starter templates instead of a dead end', () => {
  render(<TemplatesView />)
  expect(screen.getByRole('button', { name: /use the working day template/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /use the rest day template/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /use the night shift template/i })).toBeInTheDocument()
})

test('tapping a starter here adds it to the template list without stamping any day', async () => {
  const user = userEvent.setup()
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: /use the working day template/i }))

  const templates = getData().templates
  expect(templates).toHaveLength(1)
  expect(templates[0].name).toBe('Working day')
  expect(Object.keys(getData().days)).toHaveLength(0)
  expect(screen.getByText('Working day')).toBeInTheDocument()
  // The offers are gone now that a real template exists.
  expect(screen.queryByRole('button', { name: /use the rest day template/i })).not.toBeInTheDocument()
})

test('once any template exists, the starter offers no longer show here', () => {
  actions.addTemplate({ name: 'Old', color: '#f9d48a', blocks: [] })
  render(<TemplatesView />)
  expect(screen.queryByRole('button', { name: /use the working day template/i })).not.toBeInTheDocument()
})

// --- stress test: a template with 30 blocks ---------------------------------

function blockInput(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    time: `${String(6 + Math.floor(i / 3)).padStart(2, '0')}:${String((i % 3) * 20).padStart(2, '0')}`,
    title: `Block ${i}`,
    minutes: 15 + (i % 5) * 10,
  }))
}

test('a template with 30 blocks lists in the editor, opens within a generous time budget, and stamps a day with exactly 30 tasks', () => {
  const template = actions.addTemplate({ name: 'Huge day', color: '#8ab6f9', blocks: blockInput(30) })
  const t0 = performance.now()
  render(<TemplatesView />)
  const elapsed = performance.now() - t0
  expect(elapsed).toBeLessThan(2000)
  expect(screen.getByText('30 blocks')).toBeInTheDocument()

  actions.stamp({ '2026-09-01': template.id })
  expect(getData().days['2026-09-01'].tasks).toHaveLength(30)
  expect(getData().days['2026-09-01'].tasks.every(t => t.fromTemplate)).toBe(true)
})

test('opening the editor for a 30-block template shows every block, in order', async () => {
  const user = userEvent.setup()
  actions.addTemplate({ name: 'Huge day', color: '#8ab6f9', blocks: blockInput(30) })
  render(<TemplatesView />)
  await user.click(screen.getByRole('button', { name: 'Edit Huge day' }))
  const rows = document.querySelectorAll('.block-list li')
  expect(rows).toHaveLength(30)
  expect(rows[0].textContent).toContain('Block 0')
  expect(rows[29].textContent).toContain('Block 29')
})
