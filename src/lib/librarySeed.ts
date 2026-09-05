import type { AppData, LibraryItem } from './types'

/**
 * The owner's actual reading plan, put in on request so it does not have to
 * be typed in.
 *
 * It used to put itself in on first open. That was the one place in this app
 * where something was created without being asked for, and the comment here
 * named the tension with "offer, never install" and then did not weigh it
 * heavily enough: the effect fired for anybody who opened the live demo, and
 * handed a stranger the owner's real bookshelf. So it is a command now -
 * "Load my reading plan" in the palette - and nothing runs it on its own.
 * The owner's other devices never needed the automatic path, because the
 * plan is in their data and arrives by sync.
 *
 * ## Three lists, not one
 *
 * A single queue of twenty books is a queue that stalls. Everything is behind
 * whatever is at the front of it, so one heavy book in third place stops the
 * two easy ones behind it from ever being read, and the whole list starts to
 * read as a debt. Three lanes fix that without adding any ranking or tagging
 * to the data model, because a lane is just a list and this app already has
 * lists:
 *
 * - **MIND** - how people work, including you. The heaviest lane.
 * - **CRAFT** - the job, and being good at it.
 * - **LIGHT** - what gets read when nothing else will go in.
 *
 * That last one is the point of the split. "You Are Not So Smart" already
 * carried its own note saying it was the evening, optional thing, because
 * nothing in this app ranks or tags an item; now the lane says it, and the
 * note can go back to being about pace.
 *
 * Each lane advances on its own, which is what makes the split worth having
 * at the level of behaviour rather than tidiness: `upNext` in `library.ts`
 * offers the next item from the list the finished one belonged to, so
 * finishing something in LIGHT offers the next light thing rather than the
 * next chapter of Sapiens.
 *
 * The guard stays as it was, per lane: a list that already has anything in
 * it is left completely alone, so running the command twice changes nothing
 * and a single item added by hand stops that lane for good. Read
 * `seedLibrary` for the exact rule. Removing this feature is deleting this
 * file, one action in store.ts and one palette entry in App.tsx.
 */

interface SeedItem {
  /**
   * A stable id, not a fresh uuid, and this is not a detail.
   *
   * Found by syncing two devices: each one seeded its own Books list with its
   * own random ids, the merge unioned them by id the way it unions anything
   * else, and the phone ended up with two lists both called Books. Sync
   * merges per entity, so the only way two devices can seed the same thing
   * independently and end up with one of it is for the thing to have the same
   * identity on both. Seeding twice, anywhere, now produces byte-identical
   * entities and the merge is a no-op.
   */
  id: string
  title: string
  /**
   * Chapters, when the book has a useful count. Absent rather than guessed
   * for a book whose sections are short and unnumbered - the same refusal
   * `capacity.ts` makes about an unsized task, because an invented number is
   * worse than a missing one: it looks like a fact.
   */
  total?: number
  track?: LibraryItem['track']
  pace?: string
}

interface SeedList {
  /** Stable for the same reason every item id is - see `SeedItem.id`. */
  id: string
  name: string
  unit: string
  unitShort: string
  items: SeedItem[]
}

const LANES: SeedList[] = [
  {
    id: 'seed-mind',
    name: 'MIND',
    unit: 'chapter',
    unitShort: 'ch',
    items: [
      {
        id: 'seed-war-of-art',
        title: 'The War of Art',
        track: 'pages',
        pace: 'one section a day - finish Book Two, skim Book Three',
      },
      { id: 'seed-courage-to-be-disliked', title: 'The Courage to Be Disliked', total: 5, pace: 'one night per sitting' },
      { id: 'seed-daring-greatly', title: 'Daring Greatly', total: 7, pace: 'one chapter a day' },
      { id: 'seed-attached', title: 'Attached', total: 12, pace: 'one chapter a day' },
      { id: 'seed-status-game', title: 'The Status Game', pace: 'one chapter a day' },
      {
        id: 'seed-how-to-fail',
        title: 'How to Fail at Almost Everything and Still Win Big',
        total: 38,
        pace: 'short chapters, two or three a sitting',
      },
      { id: 'seed-sapiens', title: 'Sapiens', total: 20, pace: 'one chapter a day' },
      { id: 'seed-models', title: 'Models', total: 13, pace: 'one chapter a day' },
      { id: 'seed-atomic-habits', title: 'Atomic Habits', total: 20, pace: 'one chapter a day' },
      { id: 'seed-four-thousand-weeks', title: 'Four Thousand Weeks', total: 14, pace: 'one chapter a day' },
    ],
  },
  {
    id: 'seed-craft',
    name: 'CRAFT',
    unit: 'chapter',
    unitShort: 'ch',
    items: [
      { id: 'seed-turning-pro', title: 'Turning Pro', track: 'pages', pace: 'short, about a week' },
      { id: 'seed-missing-readme', title: 'The Missing README', pace: 'before day one at the job' },
      { id: 'seed-pragmatic-programmer', title: 'The Pragmatic Programmer', pace: 'dip-in, 100 tips' },
      { id: 'seed-never-split-the-difference', title: 'Never Split the Difference', total: 10, pace: 'one chapter a day' },
      { id: 'seed-deep-work', title: 'Deep Work', pace: 'when the YouTube era opens' },
    ],
  },
  {
    id: 'seed-light',
    name: 'LIGHT',
    unit: 'chapter',
    unitShort: 'ch',
    items: [
      { id: 'seed-psychology-of-money', title: 'The Psychology of Money', total: 20, pace: 'finish it' },
      { id: 'seed-siddhartha', title: 'Siddhartha', total: 12, pace: 'one chapter a sitting' },
      { id: 'seed-you-are-not-so-smart', title: 'You Are Not So Smart', total: 48, pace: 'one mechanism per chapter' },
      { id: 'seed-subtle-art', title: 'The Subtle Art of Not Giving a F*ck', total: 9, pace: 'one chapter a sitting' },
      { id: 'seed-crime-and-punishment', title: 'Crime and Punishment', pace: 'slowly' },
      { id: 'seed-musashi', title: 'Musashi', pace: 'winter' },
    ],
  },
]

function itemFor(seed: SeedItem): LibraryItem {
  const item: LibraryItem = { id: seed.id, title: seed.title }
  if (seed.pace) item.pace = seed.pace
  if (seed.total !== undefined) item.total = seed.total
  if (seed.track) item.track = seed.track
  return item
}

/**
 * Returns the state with the reading plan in it, or the same object back when
 * there is nothing to do.
 *
 * **Idempotent per lane, and by the only test that matters: a list with
 * anything in it is left completely alone.** Not "an item with this title is
 * skipped" - that would fight somebody who deleted one on purpose, and would
 * put it back every morning. One item in MIND, from any source, and MIND is
 * never filled again; the other two lanes are decided on their own terms, so
 * a half-finished run does the rest of its job next time.
 *
 * A lane that exists by name is filled in place rather than duplicated. The
 * match is on the trimmed lower-cased name for the same reason it always
 * was: a list somebody made by hand and called "mind" is that lane.
 *
 * Returning the identical object when nothing changed is what lets the caller
 * skip the commit entirely, so running this twice does not write, stamp and
 * sync a state that is the same as the one it started from.
 */
export function seedLibrary(data: AppData): AppData {
  let library = data.library
  let changed = false

  for (const lane of LANES) {
    const existing = library.find(list => list.name.trim().toLowerCase() === lane.name.toLowerCase())
    if (existing && existing.items.length > 0) continue

    const items = lane.items.map(itemFor)
    changed = true
    library = existing
      ? library.map(list => (list === existing ? { ...list, items } : list))
      : [...library, { id: lane.id, name: lane.name, unit: lane.unit, unitShort: lane.unitShort, items }]
  }

  return changed ? { ...data, library } : data
}
