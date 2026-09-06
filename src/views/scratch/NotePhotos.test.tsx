import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotePhotos } from './NotePhotos'
import { keepPhoto, memoryPhotoStore, setPhotoStore } from '../../lib/photos'

/**
 * The pictures on a note: a row of thumbnails, a full-screen look at one,
 * and the cross that takes one off. The blob is fetched from IndexedDB and
 * turned into an object URL, which is why every assertion here waits - the
 * first paint has the shape and not yet the picture, on purpose, so a row
 * of thumbnails does not reflow as they arrive.
 *
 * The case that matters most is the last one: a note synced from the other
 * device names pictures this one has never had. That is not an error and
 * not a broken frame - see DECISIONS "A photograph stays on the device it
 * was taken on".
 */

beforeEach(() => {
  setPhotoStore(memoryPhotoStore())
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:test') as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  }
})

const blob = () => new Blob([new Uint8Array(8)], { type: 'image/jpeg' })

async function twoKept() {
  const a = await keepPhoto(blob(), 1600, 1200)
  const b = await keepPhoto(blob(), 900, 1600)
  return [a!, b!]
}

test('a thumbnail is drawn at the shape the note stored, before the picture has loaded', async () => {
  const [a] = await twoKept()
  render(<NotePhotos photos={[a]} onRemove={() => {}} />)
  const button = screen.getByRole('button', { name: 'Open the picture' })
  expect(button).toHaveStyle({ aspectRatio: '1600 / 1200' })
})

test('every picture on the note gets its own thumbnail', async () => {
  const photos = await twoKept()
  const { container } = render(<NotePhotos photos={photos} onRemove={() => {}} />)
  expect(screen.getAllByRole('button', { name: 'Open the picture' })).toHaveLength(2)
  // The image element arrives with the blob; the box was there from the start.
  await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
})

test('a picture kept on another device says so in words, and is not a broken frame', async () => {
  render(<NotePhotos photos={[{ id: 'from-the-phone', width: 100, height: 100 }]} onRemove={() => {}} />)
  await screen.findByText('Kept on another device')
  expect(document.querySelector('img')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open the picture' })).toBeNull()
})

test('opening a picture fills the screen, and Escape closes it', async () => {
  const user = userEvent.setup()
  const [a] = await twoKept()
  render(<NotePhotos photos={[a]} onRemove={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Open the picture' }))
  const viewer = await screen.findByRole('dialog', { name: 'Picture' })
  expect(viewer).toBeInTheDocument()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Picture' })).toBeNull())
})

test('with more than one, the viewer walks between them and says where it is', async () => {
  const user = userEvent.setup()
  const photos = await twoKept()
  render(<NotePhotos photos={photos} onRemove={() => {}} />)
  await user.click(screen.getAllByRole('button', { name: 'Open the picture' })[0])
  await screen.findByRole('dialog', { name: 'Picture' })
  expect(screen.getByText('1 of 2')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Next picture' }))
  expect(screen.getByText('2 of 2')).toBeInTheDocument()
})

test('one picture opens with nothing to walk between', async () => {
  const user = userEvent.setup()
  const [a] = await twoKept()
  render(<NotePhotos photos={[a]} onRemove={() => {}} />)
  await user.click(screen.getByRole('button', { name: 'Open the picture' }))
  await screen.findByRole('dialog', { name: 'Picture' })
  expect(screen.queryByRole('button', { name: 'Next picture' })).toBeNull()
  expect(screen.queryByText('1 of 1')).toBeNull()
})

test('the cross names which picture it takes off, and asks the note to do it', async () => {
  const user = userEvent.setup()
  const onRemove = vi.fn()
  const photos = await twoKept()
  render(<NotePhotos photos={photos} onRemove={onRemove} />)
  await user.click(screen.getAllByRole('button', { name: /^Remove picture/ })[1])
  expect(onRemove).toHaveBeenCalledWith(photos[1].id)
})
