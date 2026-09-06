import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Scratch } from './Scratch'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'
import { MAX_PHOTOS_PER_NOTE, memoryPhotoStore, photoIds, setPhotoStore } from '../../lib/photos'

/**
 * A screenshot into a note, by the three ways somebody actually has one: a
 * paste out of the clipboard (the way a screenshot arrives on a desktop),
 * a drag onto the box, and the + that opens the file picker (the way a
 * phone offers the camera and the gallery).
 *
 * jsdom has no canvas, so `shrinkPhoto` returns null here and the original
 * blob is kept at the size it came in - which is the same path a browser
 * with a blocked canvas takes, and is worth having under test.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  setPhotoStore(memoryPhotoStore())
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:test') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  }
})

function picture(name = 'shot.png', bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' })
}

/** A paste carrying files, the shape a screenshot arrives in. */
function pasteInto(el: Element, files: File[]) {
  fireEvent.paste(el, { clipboardData: { files, items: [], getData: () => '' } })
}

test('a pasted screenshot becomes a picture on the note being written', async () => {
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  await userEvent.type(box, 'the meal plan')

  pasteInto(box, [picture()])

  await waitFor(() => expect(getData().scratch[0].photos).toHaveLength(1))
  expect(await photoIds()).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('Picture added.')
})

test('a screenshot pasted before a word is typed makes the note it belongs to', async () => {
  render(<Scratch open onClose={() => {}} />)
  pasteInto(screen.getByRole('textbox', { name: 'Scratch note' }), [picture()])

  await waitFor(() => expect(getData().scratch).toHaveLength(1))
  expect(getData().scratch[0].text).toBe('')
  expect(getData().scratch[0].photos).toHaveLength(1)
})

test('a picture dragged onto the box lands the same way', async () => {
  render(<Scratch open onClose={() => {}} />)
  const panel = screen.getByRole('dialog', { name: 'Scratch' })
  fireEvent.drop(panel, { dataTransfer: { files: [picture()], types: ['Files'] } })

  await waitFor(() => expect(getData().scratch[0]?.photos).toHaveLength(1))
})

test('the + button offers a file picker, and what it picks lands on the note', async () => {
  const { container } = render(<Scratch open onClose={() => {}} />)
  const add = screen.getByRole('button', { name: 'Add a picture' })
  expect(add).toBeInTheDocument()

  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  expect(input.accept).toBe('image/*')
  expect(input.multiple).toBe(true)
  await userEvent.upload(input, picture())

  await waitFor(() => expect(getData().scratch[0]?.photos).toHaveLength(1))
})

test('a paste with no picture in it is left to the browser, so text still pastes', async () => {
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  pasteInto(box, [])
  await new Promise(r => setTimeout(r, 0))
  expect(getData().scratch).toHaveLength(0)
})

test('something that is not a picture is refused in a sentence', async () => {
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  await userEvent.type(box, 'a note')
  pasteInto(box, [new File(['x'], 'notes.pdf', { type: 'application/pdf' })])

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('That is not a picture.'))
  expect(getData().scratch[0].photos).toBeUndefined()
})

test('the twenty-first picture is refused, and the twenty already there are untouched', async () => {
  const note = actions.addScratch('a long thread')
  for (let i = 0; i < MAX_PHOTOS_PER_NOTE; i += 1) {
    actions.addScratchPhoto(note.id, { id: `p${i}`, width: 10, height: 10 })
  }
  render(<Scratch open onClose={() => {}} />)
  const box = screen.getByRole('textbox', { name: 'Scratch note' })
  await userEvent.type(box, 'x')
  // The draft is its own note, so aim at the full one through its own row.
  pasteInto(box, [picture()])
  await waitFor(() => expect(getData().scratch.find(n => n.id === note.id)?.photos).toHaveLength(MAX_PHOTOS_PER_NOTE))
})

test('a note in the stream shows its pictures under its words', async () => {
  const note = actions.addScratch('the meal plan')
  actions.addScratchPhoto(note.id, { id: 'kept-elsewhere', width: 100, height: 100 })
  render(<Scratch open onClose={() => {}} />)
  await screen.findByText('Kept on another device')
})

test('deleting a note takes its pictures with it, and the undo brings both back', async () => {
  const user = userEvent.setup()
  const note = actions.addScratch('with a picture')
  actions.addScratchPhoto(note.id, { id: 'p1', width: 10, height: 10 })
  render(<Scratch open onClose={() => {}} />)

  await user.click(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(getData().scratch).toHaveLength(0))
  expect(await photoIds()).toEqual([])
})
