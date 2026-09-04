import type { LibraryItem, LibraryList, LibraryTrack } from './types'

/**
 * The library: lists of things worked through a unit at a time.
 *
 * Everything here is pure. The store owns the writes, the view owns the
 * pixels, and this file owns the two questions both of them keep asking -
 * what is one unit of this list called, and how far through an item are we.
 */

/** The two lists offered on an empty Library, the way Templates offers three. */
export const STARTER_LISTS: { name: string; unit: string; unitShort: string }[] = [
  { name: 'Books', unit: 'chapter', unitShort: 'ch' },
  { name: 'Watching', unit: 'episode', unitShort: 'ep' },
]

/**
 * The other lists worth one tap, offered beside a blank form rather than
 * instead of it.
 *
 * The form was never hard - a name, a unit, a short form - it was just three
 * decisions in a row at the moment somebody had one idea. These are the
 * three that kept being typed by hand, so they stopped being worth typing.
 * Anything else still goes through the form, which is why it is still there.
 */
export const LIST_PRESETS: { name: string; unit: string; unitShort: string }[] = [
  { name: 'Courses', unit: 'lesson', unitShort: 'ls' },
  { name: 'Guitar', unit: 'song', unitShort: 'sg' },
  { name: 'Recipes', unit: 'try', unitShort: 'try' },
]

/** "chapter" -> "chapters", unless the list names its own plural. */
export function unitPlural(list: Pick<LibraryList, 'unit' | 'unitPlural'>): string {
  if (list.unitPlural?.trim()) return list.unitPlural.trim()
  const unit = list.unit.trim()
  if (unit === '') return 'units'
  // Deliberately the two rules that cover almost every real unit word and
  // nothing more. English pluralisation is bottomless; a list whose unit
  // pluralises oddly says so itself in unitPlural rather than being guessed at.
  if (/(s|x|z|ch|sh)$/i.test(unit)) return unit + 'es'
  if (/[^aeiou]y$/i.test(unit)) return unit.slice(0, -1) + 'ies'
  return unit + 's'
}

/** "ch", falling back to the full unit when the list never named a short form. */
export function unitShort(list: Pick<LibraryList, 'unit' | 'unitShort'>): string {
  return list.unitShort?.trim() || list.unit.trim() || 'unit'
}

export function itemProgress(item: LibraryItem): number {
  const raw = item.progress ?? 0
  if (!Number.isFinite(raw) || raw < 0) return 0
  return item.total !== undefined ? Math.min(Math.floor(raw), item.total) : Math.floor(raw)
}

export function isItemFinished(item: LibraryItem): boolean {
  if (item.finished !== undefined) return true
  // A film has no parts to count, so nothing can conclude it is over except
  // somebody saying so. Its `finished` above is the whole of its state.
  if (item.track === 'movie') return false
  // Reaching the end of a season is not reaching the end of a series. Where
  // the count of seasons is known and there are more, the item stays going
  // and the next season is offered instead - see `nextSeason`.
  if (item.track === 'series' && hasAnotherSeason(item)) return false
  return item.total !== undefined && item.total > 0 && itemProgress(item) >= item.total
}

/** Whether a series has a season after the one being counted right now. */
export function hasAnotherSeason(item: LibraryItem): boolean {
  if (item.track !== 'series' || item.seasons === undefined) return false
  return (item.season ?? 1) < item.seasons
}

/**
 * The state a series is in once the current season is finished and there is
 * another: season up by one, count back to nothing, and the total unknown
 * again, because nobody knows how many episodes the next season has until it
 * is looked up.
 *
 * Offered rather than applied - see the detail sheet. An app that silently
 * rolled a finished season into the next one would be answering "did you
 * carry on?" on somebody's behalf.
 */
export function nextSeason(item: LibraryItem): Partial<LibraryItem> {
  return { season: (item.season ?? 1) + 1, progress: 0, total: undefined }
}

/**
 * "ch 4/12", or "ch 4" with no total. Short by design: this string sits on a
 * task card beside a title and a duration, where a sentence would not fit and
 * a bare fraction would not say what it counted.
 *
 * The four tracks read differently because they are asked about differently.
 * "p. 68/139" is a page you can open the book to; "S2 E5" is how anybody
 * refers to where they are in a series out loud; a film has no number at all
 * and saying "0/0" about one would be worse than saying nothing.
 */
export function progressLabel(list: Pick<LibraryList, 'unit' | 'unitShort'>, item: LibraryItem): string {
  const done = itemProgress(item)
  if (item.track === 'movie') return item.finished !== undefined ? 'watched' : 'not yet'
  if (item.track === 'pages') return item.total !== undefined ? `p. ${done}/${item.total}` : `p. ${done}`
  if (item.track === 'series') {
    const episode = item.total !== undefined ? `E${done}/${item.total}` : `E${done}`
    return item.season !== undefined ? `S${item.season} ${episode}` : `ep ${done}${item.total !== undefined ? `/${item.total}` : ''}`
  }
  return item.total !== undefined ? `${unitShort(list)} ${done}/${item.total}` : `${unitShort(list)} ${done}`
}

/**
 * Whether progress on this item moves one at a time.
 *
 * The +/- pair is right for chapters, lessons and episodes, and wrong for
 * pages: nobody presses + fifty-four times, and a control that expects them
 * to is a control that quietly stops being used. A page number is typed, or
 * logged after a session. A film has nothing to step at all.
 */
export function stepsOneAtATime(item: LibraryItem): boolean {
  return item.track !== 'pages' && item.track !== 'movie'
}

/** 0-100, or undefined for an item with no total to be a fraction of. */
export function progressPercent(item: LibraryItem): number | undefined {
  if (item.total === undefined || item.total <= 0) return undefined
  return Math.round((itemProgress(item) / item.total) * 100)
}

/**
 * The item a session on this list should go into: the first unfinished one.
 *
 * First rather than "most recently touched" because the list is hand-ordered
 * and drag-reorderable - the owner has already said which is next by putting
 * it there, and second-guessing that with a timestamp would make the order
 * they arranged mean nothing.
 */
export function currentItem(list: LibraryList): LibraryItem | undefined {
  return list.items.find(item => !isItemFinished(item))
}

export interface ParsedLibraryItem {
  title: string
  total?: number
  track?: LibraryTrack
  seasons?: number
  season?: number
}

/** Anything that is plausibly a unit word, so "12 chapters" parses on any list. */
const TRAILING_COUNT = /[,\u2013-]?\s*(\d{1,4})\s*([a-z]+)?\s*$/i

/** A line that names a shape instead of a count: "Interstellar, movie". */
const TRAILING_WORD = /[,\u2013-]\s*([a-z]+)\s*$/i

/**
 * Which track a trailing unit word asks for, or nothing when it is just the
 * list's own unit written out.
 *
 * Deliberately a small, closed list. "seasons" and "episodes" both mean a
 * series and differ only in which number was given, "pages" means a page
 * count, and everything else - chapters, lessons, songs, tries - is the
 * ordinary case the list already had a word for.
 */
function trackForWord(word: string | undefined): LibraryTrack | undefined {
  if (!word) return undefined
  const w = word.toLowerCase()
  if (w === 'page' || w === 'pages' || w === 'pp') return 'pages'
  if (w === 'season' || w === 'seasons') return 'series'
  if (w === 'episode' || w === 'episodes' || w === 'eps' || w === 'ep') return 'series'
  if (w === 'movie' || w === 'film') return 'movie'
  return undefined
}

/**
 * Turns one typed line into an item.
 *
 * "Daring Greatly, 12 chapters"  -> 12 of the list's own unit
 * "The War of Art, 139 pages"    -> counted in pages
 * "Invincible, 3 seasons"        -> a series, three seasons, season one
 * "From, 10 episodes"            -> a series with no seasons worth naming
 * "Interstellar, movie"          -> one sitting, no numbers
 * "Andor s2, 12"                 -> 12 of the list's own unit
 * "The Odyssey"                  -> no count at all
 *
 * The trailing number is only taken as a total when something is left in
 * front of it - "12 chapters" on its own is a title, however odd, because
 * silently producing an item with no name is worse than taking a strange one
 * at its word. A number in the middle of a line is left alone entirely, so
 * "Catch-22" and "Andor s2" survive being typed.
 *
 * A trailing *word* with no number is only read when a comma or a dash marks
 * it off. Without that, "The Third Man" would come back as a title of two
 * words and a track, which is a worse failure than not supporting the short
 * form at all.
 */
export function parseLibraryItemInput(input: string): ParsedLibraryItem | undefined {
  const text = input.trim()
  if (text === '') return undefined

  const worded = TRAILING_WORD.exec(text)
  if (worded) {
    const track = trackForWord(worded[1])
    const title = text.slice(0, worded.index).trim()
    if (track && title !== '') return { title, track }
  }

  const match = TRAILING_COUNT.exec(text)
  if (!match) return { title: text }
  const title = text.slice(0, match.index).trim().replace(/[,\u2013-]$/, '').trim()
  if (title === '') return { title: text }
  const count = Number(match[1])
  if (!Number.isFinite(count) || count <= 0) return { title: text }

  const track = trackForWord(match[2])
  // "3 seasons" says how many seasons there are and nothing about how long
  // any of them is; "10 episodes" says the opposite. The two land in
  // different fields for that reason.
  if (track === 'series' && /^seasons?$/i.test(match[2] ?? '')) {
    return { title, track: 'series', seasons: count, season: 1 }
  }
  if (track === 'movie') return { title, track: 'movie' }
  return track ? { title, total: count, track } : { title, total: count }
}

// --- the add line's two controls --------------------------------------------

/**
 * What an item is, apart from its name: how it is counted, and how long it
 * is. The add line holds one of these beside the text, the parser reads
 * one out of the text, and the two are kept as one truth - see
 * `LibraryAddLine.tsx` and CONVENTIONS section 16.
 */
export interface LibraryShape {
  /** Absent means the list's own unit. */
  track?: LibraryTrack
  /** Units in the whole thing - or episodes in a season, for a series. Absent means not known. */
  total?: number
  /** Series only. */
  seasons?: number
}

/** The part of a typed line that says its shape, if any: ", 12 chapters", ", movie", " - 3 seasons". */
const TRAILING_SHAPE = /\s*[,\u2013-]\s*(?:\d{1,4}\s*[a-z]*|[a-z]+)\s*$/i

/**
 * The title alone - the line without the shape the parser would read from
 * its end. Only a shape marked off by a comma or a dash is stripped, and
 * only when the parser would have read it as one: "Catch-22" and "The Third
 * Man" keep every character.
 */
export function stripTrailingShape(line: string): string {
  const parsed = parseLibraryItemInput(line)
  if (!parsed) return line.trim()
  if (parsed.total === undefined && parsed.track === undefined && parsed.seasons === undefined) return line.trim()
  const stripped = line.replace(TRAILING_SHAPE, '').trim()
  return stripped === '' ? line.trim() : stripped
}

/**
 * The line that says a title and a shape, in the words the parser reads:
 * the words, not a second field, so what is stored and what is shown are
 * one thing - the same rule quick-add follows for a time typed into a line.
 */
export function shapeLine(title: string, shape: LibraryShape, list: Pick<LibraryList, 'unit' | 'unitPlural'>): string {
  const t = title.trim()
  if (shape.track === 'movie') return `${t}, movie`
  if (shape.track === 'series') return shape.seasons !== undefined ? `${t}, ${shape.seasons} ${shape.seasons === 1 ? 'season' : 'seasons'}` : `${t}, series`
  if (shape.track === 'pages') return shape.total !== undefined ? `${t}, ${shape.total} pages` : `${t}, pages`
  if (shape.total !== undefined) return `${t}, ${shape.total} ${shape.total === 1 ? list.unit : unitPlural(list)}`
  return t
}

/** What the parser understood of a line, as a shape - the half the controls show. */
export function shapeOf(parsed: ParsedLibraryItem | undefined): LibraryShape {
  if (!parsed) return {}
  const shape: LibraryShape = {}
  if (parsed.track) shape.track = parsed.track
  if (parsed.total !== undefined) shape.total = parsed.total
  if (parsed.seasons !== undefined) shape.seasons = parsed.seasons
  return shape
}

/** Whether a line carries a shape of its own, which is what makes the controls follow the words. */
export function lineHasShape(line: string): boolean {
  const parsed = parseLibraryItemInput(line)
  return !!parsed && (parsed.total !== undefined || parsed.track !== undefined || parsed.seasons !== undefined)
}

/**
 * The unit words a new list is usually counted in, offered as chips so the
 * common case is a tap. Anything else is typed, as before.
 */
export const UNIT_SUGGESTIONS = ['lesson', 'song', 'episode', 'session', 'try', 'chapter'] as const

/**
 * A short form for a unit, for the card: "ch", "ep", "ls". The ones this
 * app has used are written down; anything else is the first two letters,
 * which is right often enough to be worth offering and wrong in a way that
 * takes one keystroke to fix.
 */
export function suggestShortForm(unit: string): string {
  const u = unit.trim().toLowerCase()
  const known: Record<string, string> = {
    chapter: 'ch',
    episode: 'ep',
    lesson: 'ls',
    song: 'sg',
    session: 'ss',
    try: 'try',
    page: 'p.',
    level: 'lv',
    week: 'wk',
    module: 'mod',
  }
  if (known[u]) return known[u]
  return u.slice(0, 2)
}

/**
 * How big something is, in its own words: "306 pages", "12 chapters",
 * "3 seasons", and nothing at all for a film or for anything whose length
 * nobody has written down.
 *
 * Not `progressLabel`, which says where you are in something you have
 * started. This is said about a thing not started yet, where "p. 0/306" is
 * a strange way to describe a book. It reads the item's own track rather
 * than the list's unit, which is the bug this replaced: a page-counted book
 * on a list counted in chapters was announced as "306 chapters".
 */
export function itemSizeLabel(list: Pick<LibraryList, 'unit' | 'unitPlural'>, item: LibraryItem): string | undefined {
  if (item.track === 'movie') return undefined
  if (item.track === 'series') {
    if (item.seasons !== undefined) return `${item.seasons} ${item.seasons === 1 ? 'season' : 'seasons'}`
    if (item.total !== undefined) return `${item.total} ${item.total === 1 ? 'episode' : 'episodes'}`
    return undefined
  }
  if (item.total === undefined) return undefined
  if (item.track === 'pages') return `${item.total} ${item.total === 1 ? 'page' : 'pages'}`
  return `${item.total} ${item.total === 1 ? list.unit : unitPlural(list)}`
}

/**
 * What a list moves on to after one of its own was finished today, and what
 * finished. Absent when nothing on this list ended today, or when the thing
 * that ended was the last one there was.
 *
 * The reason this exists at all: a template block binds to the *list*, not to
 * the item it was started from, so the morning after a book ends the block
 * already reads the next one. That worked and nothing said so - the queue
 * behaved like a conveyor and looked like a list. This is the sentence that
 * says it, and the handle the Library hangs a one-press session on.
 *
 * Bounded to today on purpose. It is a moment, not a state: a book finished
 * three weeks ago has nothing left to announce, and a line that never goes
 * away is a line nobody reads. The finished side is the *last* one in the
 * list's own order that ended today, because that is the one whose ending
 * pushed the queue along; two in a day is rare and the later one is the news.
 */
export function upNext(list: LibraryList, today: string): { finished: LibraryItem; next: LibraryItem } | undefined {
  let finished: LibraryItem | undefined
  for (const item of list.items) if (item.finished === today) finished = item
  if (!finished) return undefined
  const next = currentItem(list)
  if (!next) return undefined
  return { finished, next }
}
