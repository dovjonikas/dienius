import { afterEach, expect, test, vi } from 'vitest'
import {
  canPickFile,
  memoryHandleStore,
  onDeviceFile,
  onDeviceLink,
  openOnDevice,
  pickFile,
} from './localFile'
import { linkKind, linkLabel, linkRefusal } from './link'

/**
 * A file on this computer, pointed at once and pressed afterwards.
 *
 * The owner had a PDF on their disk, put `file://` in a link field, and got
 * nothing. A page cannot open a file by its path in any browser; what it can
 * do is hold a **handle** the person handed it through a picker, and read the
 * file through that. The handle stays on this device, the item carries an id
 * and a name, and the other device says which file it means.
 *
 * Neither the picker nor IndexedDB is in jsdom, so the store is an interface
 * with an in-memory implementation - the same shape photos.ts uses, and the
 * same thing the real one degrades to when a private window refuses the
 * database.
 */

/** A handle, as far as anything here is concerned: a name and a file. */
function fakeHandle(name: string, contents = 'a pdf, more or less'): FileSystemFileHandle {
  return {
    name,
    kind: 'file',
    getFile: async () => new File([contents], name, { type: 'application/pdf' }),
  } as unknown as FileSystemFileHandle
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the link carries the id and the name, and reads back as both', () => {
  const link = onDeviceLink({ id: 'abc123', name: 'Deep Work.pdf' })
  expect(onDeviceFile(link)).toEqual({ id: 'abc123', name: 'Deep Work.pdf' })
})

test('a name with the characters a filename really has survives the round trip', () => {
  // A slash is the one that matters: the id and the name are separated by
  // one, so a name containing one has to come back whole.
  for (const name of ['1/2 finished, vol 3.pdf', 'Šis tas.pdf', 'a b & c #4.pdf']) {
    const link = onDeviceLink({ id: 'x', name })
    expect(onDeviceFile(link)?.name).toBe(name)
  }
})

test('an ordinary address is not a file, and is left entirely alone', () => {
  for (const link of ['https://example.com/x', 'http://192.168.1.4/books', 'ondevice:', 'ondevice:/no-id']) {
    expect(onDeviceFile(link)).toBeUndefined()
  }
})

test('the link says it is a file, and shows the name rather than the id', () => {
  const link = onDeviceLink({ id: 'abc123', name: 'Deep Work.pdf' })
  expect(linkKind(link)).toBe('device')
  expect(linkLabel(link)).toBe('Deep Work.pdf')
  // Written by a button, never typed, so there is nothing to correct about it.
  expect(linkRefusal(link)).toBeUndefined()
})

test('the picker is absent rather than broken where the browser has none', async () => {
  // Which is every iPhone. jsdom is the same shape, so this is the default.
  expect(canPickFile()).toBe(false)
  expect(await pickFile(memoryHandleStore(), 'id')).toBeNull()
})

test('picking keeps the handle and answers with the name', async () => {
  vi.stubGlobal('showOpenFilePicker', async () => [fakeHandle('Deep Work.pdf')])
  const store = memoryHandleStore()
  expect(await pickFile(store, 'abc123')).toEqual({ id: 'abc123', name: 'Deep Work.pdf' })
  expect(await store.get('abc123')).not.toBeNull()
})

test('a dismissed picker is not an error and keeps nothing', async () => {
  vi.stubGlobal('showOpenFilePicker', async () => {
    throw new DOMException('The user aborted a request.', 'AbortError')
  })
  const store = memoryHandleStore()
  expect(await pickFile(store, 'abc123')).toBeNull()
  expect(await store.get('abc123')).toBeNull()
})

test('a store that will not keep the handle refuses the whole thing', async () => {
  // An item pointing at a handle nobody kept is a door onto nothing, which
  // is the exact thing this feature exists to stop being.
  vi.stubGlobal('showOpenFilePicker', async () => [fakeHandle('Deep Work.pdf')])
  const refuses = { ...memoryHandleStore(), put: async () => false }
  expect(await pickFile(refuses, 'abc123')).toBeNull()
})

test('a file this device never had says so, rather than failing quietly', async () => {
  vi.stubGlobal('open', () => null)
  expect(await openOnDevice(memoryHandleStore(), 'never-picked-here')).toBe('elsewhere')
})

test('permission refused is its own answer', async () => {
  const handle = fakeHandle('Deep Work.pdf')
  handle.queryPermission = async () => 'prompt'
  handle.requestPermission = async () => 'denied'
  const store = memoryHandleStore()
  await store.put('abc123', handle)
  vi.stubGlobal('open', () => ({ close: () => {}, location: { href: '' } }))
  expect(await openOnDevice(store, 'abc123')).toBe('denied')
})

test('a file that has moved since it was picked is its own answer too', async () => {
  const handle = fakeHandle('Deep Work.pdf')
  handle.getFile = async () => {
    throw new DOMException('A requested file could not be found.', 'NotFoundError')
  }
  const store = memoryHandleStore()
  await store.put('abc123', handle)
  vi.stubGlobal('open', () => ({ close: () => {}, location: { href: '' } }))
  expect(await openOnDevice(store, 'abc123')).toBe('gone')
})

test('the happy path points the tab it took at the file', async () => {
  const store = memoryHandleStore()
  await store.put('abc123', fakeHandle('Deep Work.pdf'))
  const tab = { close: vi.fn(), location: { href: '' } }
  // The tab is taken before anything is awaited, while the press is still in
  // hand: a browser lets a page open one because somebody just pressed
  // something, and that does not survive every await.
  vi.stubGlobal('open', vi.fn(() => tab))
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:the-file', revokeObjectURL: () => {} })

  expect(await openOnDevice(store, 'abc123')).toBe('opened')
  expect(tab.location.href).toBe('blob:the-file')
  expect(tab.close).not.toHaveBeenCalled()
})

test('the tab is taken without noopener, which is what makes it a tab it can point', async () => {
  // This one is here because the browser caught what the stub above did not.
  // `window.open(..., 'noopener')` opens the tab and returns **null**, so the
  // reference the whole approach depends on is gone and the owner gets a
  // blank tab and a sentence saying the file could not be opened. A stub that
  // hands back a tab whatever it is passed is more generous than the browser.
  const opens = vi.fn(() => ({ close: () => {}, location: { href: '' } }))
  vi.stubGlobal('open', opens)
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:the-file', revokeObjectURL: () => {} })
  const store = memoryHandleStore()
  await store.put('abc123', fakeHandle('Deep Work.pdf'))

  await openOnDevice(store, 'abc123')
  expect(opens).toHaveBeenCalledWith('', '_blank')
})

test('the tab it took is closed again when the file cannot be had', async () => {
  const tab = { close: vi.fn(), location: { href: '' } }
  vi.stubGlobal('open', vi.fn(() => tab))
  expect(await openOnDevice(memoryHandleStore(), 'never-picked-here')).toBe('elsewhere')
  expect(tab.close).toHaveBeenCalled()
})
