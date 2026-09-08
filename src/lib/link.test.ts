import { expect, test } from 'vitest'
import { linkFor, linkKind, linkLabel, parseLink } from './link'
import type { LibraryList, Task } from './types'

/**
 * What survives being typed into the field, and what quietly does not.
 *
 * The gate is deliberately lopsided: forgiving about what a person types,
 * strict about what is kept. Nothing here or anywhere downstream asks the
 * network whether an address answers - see the module's own note.
 */

test('a full address is kept as it was written', () => {
  expect(parseLink('https://example.com/spanish')).toBe('https://example.com/spanish')
})

test('a missing scheme is filled in - https for the internet', () => {
  expect(parseLink('example.com/spanish')).toBe('https://example.com/spanish')
})

test('and http for a machine of your own, which is what those actually serve', () => {
  expect(parseLink('localhost:8080/spanish')).toBe('http://localhost:8080/spanish')
  expect(parseLink('192.168.1.4/lessons')).toBe('http://192.168.1.4/lessons')
})

test('a bare word is a word, not an address', () => {
  expect(parseLink('notes')).toBeUndefined()
  expect(parseLink('spanish lessons')).toBeUndefined()
})

test('an empty field is nothing rather than a bad address', () => {
  expect(parseLink('')).toBeUndefined()
  expect(parseLink('   ')).toBeUndefined()
})

/**
 * The one gate between a typed string and an `href`. `javascript:` is not a
 * link to anywhere - it is a way to run code inside this app - and the other
 * two are ways to hand somebody a file they did not ask for.
 */
test('only http and https survive', () => {
  expect(parseLink('javascript:alert(1)')).toBeUndefined()
  expect(parseLink('data:text/html,<script>alert(1)</script>')).toBeUndefined()
  expect(parseLink('file:///C:/Users')).toBeUndefined()
  expect(parseLink('ftp://example.com')).toBeUndefined()
})

test('a machine of your own is told apart from the open internet', () => {
  for (const own of [
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://192.168.1.4',
    'http://10.0.0.7/x',
    'http://172.16.4.4',
    'https://box.tail9f3c.ts.net/spanish',
    'http://nas.local',
  ]) {
    expect(linkKind(own), own).toBe('own')
  }
  for (const out of ['https://example.com', 'https://duolingo.com/learn', 'http://172.32.0.1']) {
    expect(linkKind(out), out).toBe('external')
  }
})

/** Tailscale borrows 100.64.0.0/10, so the edges of that range matter. */
test('the whole of Tailscale range is yours and its neighbours are not', () => {
  expect(linkKind('http://100.64.0.1')).toBe('own')
  expect(linkKind('http://100.127.255.254')).toBe('own')
  expect(linkKind('http://100.63.0.1')).toBe('external')
  expect(linkKind('http://100.128.0.1')).toBe('external')
})

test('something that is not an address at all reads as external rather than yours', () => {
  expect(linkKind('not a url')).toBe('external')
})

/** The bubble says where it goes, without the two parts nobody reads. */
test('the label is the whole address without its scheme or a trailing slash', () => {
  expect(linkLabel('http://192.168.1.4/spanish/easy')).toBe('192.168.1.4/spanish/easy')
  expect(linkLabel('https://example.com/')).toBe('example.com')
})

const BOOKS: LibraryList[] = [
  {
    id: 'l1',
    name: 'Spanish',
    unit: 'lesson',
    items: [
      { id: 'i1', title: 'Easy lessons', link: 'http://localhost:8080/easy' },
      { id: 'i2', title: 'No link here' },
    ],
  },
]

const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Spanish', done: false, ...over })

test('a task with no link of its own takes the one on the item it is bound to', () => {
  expect(linkFor(task({ libraryRef: { listId: 'l1', itemId: 'i1' } }), BOOKS)).toBe('http://localhost:8080/easy')
})

test('a task with its own link keeps it, whatever the item says', () => {
  const own = task({ link: 'https://example.com/mine', libraryRef: { listId: 'l1', itemId: 'i1' } })
  expect(linkFor(own, BOOKS)).toBe('https://example.com/mine')
})

test('a binding that resolves to nothing contributes nothing', () => {
  expect(linkFor(task({ libraryRef: { listId: 'gone', itemId: 'i1' } }), BOOKS)).toBeUndefined()
  expect(linkFor(task({ libraryRef: { listId: 'l1', itemId: 'i2' } }), BOOKS)).toBeUndefined()
  expect(linkFor(task({}), BOOKS)).toBeUndefined()
})
