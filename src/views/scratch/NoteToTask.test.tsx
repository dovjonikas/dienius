import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Scratch } from './Scratch'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { memoryPhotoStore, setPhotoStore } from '../../lib/photos'
import { todayKey } from '../../lib/dates'

/**
 * A note becoming a task, in one press, with everything about that task on
 * screen before it exists.
 *
 * Until v2.5 the note went through quick-add's parser and vanished, which
 * got two things wrong at once: a line written as a thought rarely reads as
 * "14:00 Call the bank 20 min", so it landed untimed and unsized; and the
 * note was gone, so the words it was written in were gone too. Now the
 * press opens the editor with the title already filled, and the note stays
 * with a quiet mark saying where it went.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  setPhotoStore(memoryPhotoStore())
})

const open = () => render(<Scratch open onClose={() => {}} />)
const today = () => getData().days[todayKey()]?.tasks ?? []

test('To task opens the editor with the note as the title, and adds nothing yet', async () => {
  const user = userEvent.setup()
  actions.addScratch('Order the replacement charger')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  const sheet = screen.getByRole('dialog', { name: 'New task from a note' })
  expect(sheet.querySelector('input')).toHaveValue('Order the replacement charger')
  expect(today()).toHaveLength(0)
})

test('Save puts it on today, and the note stays with a mark saying where it went', async () => {
  const user = userEvent.setup()
  const note = actions.addScratch('Order the replacement charger')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(today().map(t => t.title)).toEqual(['Order the replacement charger'])
  expect(getData().scratch).toHaveLength(1)
  expect(getData().scratch[0].taskId).toBe(today()[0].id)
  expect(getData().scratch[0].taskDate).toBe(todayKey())
  expect(today()[0].fromNote).toBe(note.id)
  expect(screen.getByRole('button', { name: /^Open the task/ })).toBeInTheDocument()
})

test('the title can be changed before it is saved, and the note keeps its own words', async () => {
  const user = userEvent.setup()
  actions.addScratch('charger. the usb c one. from the drawer')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  const title = screen.getByRole('textbox', { name: 'What it is' })
  await user.clear(title)
  await user.type(title, 'Order a USB-C charger')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(today().map(t => t.title)).toEqual(['Order a USB-C charger'])
  expect(getData().scratch[0].text).toBe('charger. the usb c one. from the drawer')
})

test('Cancel adds no task and leaves the note exactly as it was', async () => {
  const user = userEvent.setup()
  actions.addScratch('Order the replacement charger')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(today()).toHaveLength(0)
  expect(getData().scratch[0].taskId).toBeUndefined()
  expect(screen.queryByRole('dialog', { name: 'New task from a note' })).toBeNull()
})

test('a time and a length given here are the task the day gets', async () => {
  const user = userEvent.setup()
  actions.addScratch('Call the bank')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  const time = screen.getByRole('textbox', { name: 'Start time' })
  await user.clear(time)
  await user.type(time, '14:00')
  await user.click(screen.getByRole('button', { name: '30min' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(today()[0]).toMatchObject({ title: 'Call the bank', time: '14:00', minutes: 30 })
})

test('key marked here is key on the day', async () => {
  const user = userEvent.setup()
  actions.addScratch('Write the proposal')
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Mark as key' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(today()[0].highlight).toBe(true)
})

test('a note already made into a task offers the way to it rather than making a second one', async () => {
  const user = userEvent.setup()
  actions.addScratch('Order the replacement charger')
  open()
  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(screen.queryByRole('button', { name: 'To task' })).toBeNull()
  expect(screen.getByRole('button', { name: /^Open the task/ })).toBeInTheDocument()
})

test('the pictures stay on the note, and the task says where to find them', async () => {
  const user = userEvent.setup()
  const note = actions.addScratch('the meal plan')
  actions.addScratchPhoto(note.id, { id: 'p1', width: 100, height: 100 })
  open()

  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(getData().scratch[0].photos).toHaveLength(1)
  expect(today()[0].fromNote).toBe(note.id)
})

test('opening the task hands the day and the task back to the shell', async () => {
  const user = userEvent.setup()
  const onOpenTask = vi.fn()
  actions.addScratch('Order the replacement charger')
  render(<Scratch open onClose={() => {}} onOpenTask={onOpenTask} />)

  await user.click(screen.getByRole('button', { name: 'To task' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await user.click(screen.getByRole('button', { name: /^Open the task/ }))

  expect(onOpenTask).toHaveBeenCalledWith(todayKey(), today()[0].id)
})
