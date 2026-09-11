import { canPickFile, onDeviceFile } from './localFile'
import type { LibraryList, Task } from './types'

/**
 * The one link a library item or a task can carry, and how it is read.
 *
 * The owner's case: a Spanish course whose next lesson is a page on a machine
 * at home, a book with an edition online, a series on whatever it is on. The
 * planner says what to do next; the link is the door to the thing itself, so
 * that "Up next: Spanish, easy lessons" is one press from being open.
 *
 * Everything here is arithmetic on a string. **Nothing in this file, or in
 * anything that uses it, goes to the network**: no reachability check, no
 * favicon, no title fetch, no preview. Whether an address answers is between
 * the owner and their own machine - half the ones this is for are on a home
 * network that this app has no business knowing about - and a planner that
 * quietly asks the internet about the contents of somebody's day is a
 * different kind of program from this one.
 */

/**
 * The address as it will be stored, or `undefined` for anything that is not
 * one.
 *
 * Deliberately forgiving about what somebody types and strict about what is
 * kept. "localhost:8080", "192.168.1.4/lessons" and "example.com/x" are all
 * addresses a person means; `https://` is added where a scheme is missing,
 * and `http://` for a machine on the local network, which is what those
 * actually serve.
 *
 * Only http and https survive. `javascript:`, `data:`, `file:` and the rest
 * are not links to anywhere - one of them is a way to run code inside this
 * app - and this is the one gate between a typed string and an `href`.
 *
 * Most refusals are silent by design: a half-typed word is not an error, and
 * there is nothing to correct. One is not, and `linkRefusal` below is that
 * one - see the owner's report about a PDF.
 */
export function parseLink(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed === '' || /\s/.test(trimmed)) return undefined

  // "localhost:8080/x" is a host and a port, not a scheme called localhost,
  // and reading it as one is how a perfectly good address came back
  // undefined. A colon followed by digits is a port; a colon followed by
  // anything else, or by //, is a scheme - which is what lets javascript:
  // and data: be recognised and then refused below.
  const withScheme = /^[a-z][a-z0-9+.-]*:(?:\/\/|[^0-9])/i.test(trimmed)
  const candidate = withScheme ? trimmed : `${localHostname(trimmed) ? 'http' : 'https'}://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (url.hostname === '') return undefined
  // A bare word is a word. "notes" is not an address, and turning it into
  // https://notes because it parses would be this app inventing a
  // destination.
  if (!url.hostname.includes('.') && !isLocalName(url.hostname)) return undefined
  return url.toString()
}

/**
 * The one refusal worth a sentence, and why exactly one.
 *
 * The owner put a `file://` path to a PDF into a link field. Nothing was
 * saved and nothing was said, so the field looked broken. It was not: a
 * browser will not open a file on the reader's own disk from a page, at all,
 * and this was confirmed rather than remembered - Chromium answers a click
 * on one with "Not allowed to load local resource" and does not move.
 *
 * So accepting it would have been worse than refusing it: a door that opens
 * onto nothing is worse than no door. What was wrong was the silence.
 *
 * Only for a string that *is* an address in some scheme this cannot open.
 * A bare word stays silent, because there really is nothing to correct
 * there - somebody is halfway through typing.
 */
export function linkRefusal(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed === '' || parseLink(trimmed) !== undefined) return undefined
  // The app's own scheme for a file picked on this computer. It is never
  // typed - a button writes it - so it is never something to correct.
  if (onDeviceFile(trimmed)) return undefined
  const scheme = /^([a-z][a-z0-9+.-]*):(?:\/\/|[^0-9])/i.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme || scheme === 'http' || scheme === 'https') return undefined
  if (scheme === 'file') {
    // Two answers, because there are two situations. Where the browser has
    // a file picker the owner wants the file, not an address, and saying
    // "run a server" to somebody who has a PDF on the same machine is an
    // answer to a question they did not ask - see localFile.ts. Where there
    // is no picker, which is every iPhone, an address really is the answer.
    return canPickFile()
      ? 'A page cannot open a file on your disk by its path. Press Pick a file below and it opens from here, on this computer.'
      : 'A page cannot open a file on your own disk. Serve the folder at an address like 192.168.1.4/books and link that, and it works from the phone too.'
  }
  return 'Only http and https addresses can be opened from here.'
}

/**
 * Which of the two icons an address gets: one for something on this person's
 * own machines, one for the open internet.
 *
 * The distinction is the owner's own: a link to a box at home behaves
 * differently from a link to a website - it works on one network and not
 * another, and it is theirs. Tailscale is in the first group because that is
 * what the owner reaches their machines through: its MagicDNS names end in
 * `.ts.net` and its addresses live in 100.64.0.0/10, the range reserved for
 * carrier-grade NAT that it borrows.
 *
 * Anything unrecognised is external. A guess that says "this is yours" about
 * something on the internet is the wrong way round to be wrong.
 */
export function linkKind(link: string): 'own' | 'external' | 'device' {
  // Not a hostname question at all: it is a file on this disk, and it is the
  // most "own" a thing can be.
  if (onDeviceFile(link)) return 'device'
  try {
    return isLocalName(new URL(link).hostname) ? 'own' : 'external'
  } catch {
    return 'external'
  }
}

/**
 * The address as the bubble shows it: the whole thing, minus the scheme and a
 * trailing slash, which are the two parts nobody reads.
 *
 * The whole address rather than the host alone, because where a link goes is
 * the question the bubble exists to answer, and "192.168.1.4" and
 * "192.168.1.4/spanish/easy" are different answers.
 */
export function linkLabel(link: string): string {
  // A file says its own name. An id is not something to show anybody.
  const file = onDeviceFile(link)
  if (file) return file.name
  const withoutScheme = link.replace(/^https?:\/\//, '')
  return withoutScheme.endsWith('/') ? withoutScheme.slice(0, -1) : withoutScheme
}

/** A name or address on this person's own machines rather than on the internet. */
function isLocalName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true
  if (host.endsWith('.ts.net') || host.endsWith('.local')) return true
  const parts = host.split('.')
  if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p))) return false
  const [a, b] = parts.map(Number)
  if (a > 255 || b > 255) return false
  if (a === 127 || a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  // Tailscale's own range, 100.64.0.0/10.
  return a === 100 && b >= 64 && b <= 127
}

/** Whether a typed string names a local machine, before a scheme is chosen for it. */
function localHostname(text: string): boolean {
  return isLocalName(text.split('/')[0].split(':')[0])
}

/**
 * The address a task is a door to: its own, else the one on the library item
 * it is bound to.
 *
 * Its own wins because it is the more specific answer - a reading block with
 * an address typed onto it is about that address. A binding that resolves to
 * nothing contributes nothing, the same contract every dangling id in this
 * app keeps.
 */
export function linkFor(task: Task, library: LibraryList[]): string | undefined {
  if (task.link) return task.link
  if (!task.libraryRef) return undefined
  const list = library.find(l => l.id === task.libraryRef!.listId)
  return list?.items.find(i => i.id === task.libraryRef!.itemId)?.link
}
