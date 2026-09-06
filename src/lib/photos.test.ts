import { beforeEach, expect, test } from 'vitest'
import {
  MAX_PHOTOS_PER_NOTE,
  MAX_PHOTO_BYTES,
  PHOTO_MAX_EDGE,
  fitWithin,
  deletePhotos,
  hasPhoto,
  keepPhoto,
  photoIds,
  readPhoto,
  refusePhoto,
  setPhotoStore,
  memoryPhotoStore,
} from './photos'

/**
 * Photographs live in IndexedDB and nowhere else - not in the state, not in
 * a sync payload, not in the backup JSON. See DECISIONS "A photograph stays
 * on the device it was taken on". What the state holds is an id and the two
 * numbers needed to lay the thumbnail out before the blob has loaded.
 *
 * IndexedDB is not in jsdom, so the store is an interface with an in-memory
 * implementation for tests, which is also what the real one degrades to
 * when a private window refuses the database.
 */

beforeEach(() => {
  setPhotoStore(memoryPhotoStore())
})

function blob(bytes: number, type = 'image/jpeg'): Blob {
  return new Blob([new Uint8Array(bytes)], { type })
}

// --- what a photograph is scaled to ---------------------------------------

test('the longer edge comes down to the limit and the shape is kept', () => {
  expect(PHOTO_MAX_EDGE).toBe(1600)
  expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 })
  expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
})

test('a picture already inside the limit is left at the size it is', () => {
  expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 })
})

test('a strip never rounds down to nothing', () => {
  expect(fitWithin(4000, 3, 1600)).toEqual({ width: 1600, height: 1 })
})

// --- the two limits, and what they say --------------------------------------

test('a photograph over the size limit is refused in a sentence, not a code', () => {
  expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024)
  expect(refusePhoto(blob(MAX_PHOTO_BYTES + 1), 0)).toBe('That picture is still over 5 MB after shrinking. Crop it and try again.')
  expect(refusePhoto(blob(MAX_PHOTO_BYTES), 0)).toBe(null)
})

test('a note holds twenty pictures, and the twenty-first says so', () => {
  expect(MAX_PHOTOS_PER_NOTE).toBe(20)
  expect(refusePhoto(blob(10), MAX_PHOTOS_PER_NOTE - 1)).toBe(null)
  expect(refusePhoto(blob(10), MAX_PHOTOS_PER_NOTE)).toBe('A note holds 20 pictures. Start another note for the rest.')
})

test('something that is not an image is refused before it is measured', () => {
  expect(refusePhoto(blob(10, 'application/pdf'), 0)).toBe('That is not a picture.')
})

// --- keeping and reading ---------------------------------------------------

test('a kept photograph comes back by its id, with the size it was kept at', async () => {
  const kept = await keepPhoto(blob(120), 1600, 1200)
  expect(kept).toMatchObject({ width: 1600, height: 1200 })
  expect(kept?.id).toMatch(/./)
  const back = await readPhoto(kept!.id)
  expect(back?.size).toBe(120)
})

test('a photograph that is not there reads as nothing rather than throwing', async () => {
  expect(await readPhoto('never-existed')).toBe(null)
  expect(await hasPhoto('never-existed')).toBe(false)
})

test('a store that refuses to keep anything is a photograph that was not added', async () => {
  setPhotoStore({
    put: async () => false,
    get: async () => null,
    delete: async () => {},
    keys: async () => [],
  })
  expect(await keepPhoto(blob(10), 100, 100)).toBe(null)
})

// --- deleting --------------------------------------------------------------

test('deleting a note deletes its photographs, so nothing is left orphaned', async () => {
  const a = await keepPhoto(blob(10), 100, 100)
  const b = await keepPhoto(blob(10), 100, 100)
  const c = await keepPhoto(blob(10), 100, 100)
  await deletePhotos([a!.id, b!.id])
  expect(await photoIds()).toEqual([c!.id])
})

test('deleting one that is already gone is quiet, so the same delete can arrive twice', async () => {
  const a = await keepPhoto(blob(10), 100, 100)
  await deletePhotos([a!.id])
  await deletePhotos([a!.id])
  expect(await photoIds()).toEqual([])
})
