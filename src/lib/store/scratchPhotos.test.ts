import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from '../store'
import { deletePhotos, keepPhoto, memoryPhotoStore, photoIds, setPhotoStore } from '../photos'
import { defaultData } from '../storage'

/**
 * A note with pictures in it, from the store's side: the id list on the
 * note, the delete that takes the blobs with it, and the sweep that catches
 * a blob whose note is gone anyway - a delete can be interrupted by a closed
 * tab, and an orphan nobody can see is the kind of thing that fills a
 * database over a year.
 *
 * The pictures themselves are lib/photos.ts, which has its own tests.
 */

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
  setPhotoStore(memoryPhotoStore())
})

const blob = () => new Blob([new Uint8Array(8)], { type: 'image/jpeg' })

test('a picture is added to a note as an id and a shape, never as the picture', async () => {
  const note = actions.addScratch('the meal plan')
  const kept = await keepPhoto(blob(), 1600, 1200)
  actions.addScratchPhoto(note.id, kept!)

  expect(getData().scratch[0].photos).toEqual([{ id: kept!.id, width: 1600, height: 1200 }])
  expect(JSON.stringify(getData())).not.toContain('Blob')
})

test('a picture added to a note that is gone changes nothing', async () => {
  const kept = await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto('no-such-note', kept!)
  expect(getData().scratch).toEqual([])
})

test('removing one picture leaves the others and takes the blob with it', async () => {
  const note = actions.addScratch('two pictures')
  const a = await keepPhoto(blob(), 100, 100)
  const b = await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto(note.id, a!)
  actions.addScratchPhoto(note.id, b!)

  await actions.removeScratchPhoto(note.id, a!.id)
  expect(getData().scratch[0].photos).toEqual([{ id: b!.id, width: 100, height: 100 }])
  expect(await photoIds()).toEqual([b!.id])
})

test('a note with no pictures left carries no empty list to explain', async () => {
  const note = actions.addScratch('one picture')
  const a = await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto(note.id, a!)
  await actions.removeScratchPhoto(note.id, a!.id)
  expect(getData().scratch[0].photos).toBeUndefined()
})

test('deleting a note deletes its pictures too', async () => {
  const note = actions.addScratch('with a picture')
  const a = await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto(note.id, a!)

  await actions.deleteScratchWithPhotos(note.id)
  expect(getData().scratch).toEqual([])
  expect(await photoIds()).toEqual([])
})

// The undo of a delete puts the note back, and the picture with it - so the
// delete has to keep the blob until the offer is gone. It does the opposite
// on purpose: the blob goes with the note, and undo restores a note whose
// pictures read as "kept on another device". That would be a lie on the
// device that just deleted them, so undo restores the blobs as well.
test('undoing a delete brings the pictures back, not a note pointing at nothing', async () => {
  const note = actions.addScratch('with a picture')
  const a = await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto(note.id, a!)
  const undo = await actions.deleteScratchWithPhotos(note.id)
  await undo()

  expect(getData().scratch[0].photos).toEqual([{ id: a!.id, width: 100, height: 100 }])
  expect(await photoIds()).toEqual([a!.id])
})

test('the orphan sweep deletes a blob no note points at, and never one that is in use', async () => {
  const note = actions.addScratch('kept')
  const used = await keepPhoto(blob(), 100, 100)
  await keepPhoto(blob(), 100, 100)
  actions.addScratchPhoto(note.id, used!)

  await actions.sweepPhotos()
  expect(await photoIds()).toEqual([used!.id])
})

test('the sweep is quiet when the store is empty, so it can run on every open', async () => {
  await actions.sweepPhotos()
  expect(await photoIds()).toEqual([])
  await deletePhotos([])
})
