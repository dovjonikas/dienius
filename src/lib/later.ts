import type { AppData, LaterItem } from './types'

/**
 * Folds whatever an older payload still holds in `inbox` into the top of
 * Later, once.
 *
 * Until v2.7 there were two undated shelves, and a payload from before then -
 * a backup, a snapshot, the state an older device pushes to the sync server -
 * still carries both. Nothing downstream should have to know that: the day
 * view, the week, the category counts and the store all read one list. So
 * the fold happens at the two doors a payload comes in through, `loadData`
 * and the sync merge, and everything past those doors sees `inbox` as `[]`.
 *
 * The inbox lines go first, in their own order, and the existing Later after
 * them. The inbox was newest-first and Later is a ranking, so "on top" is the
 * one placement that keeps both orders as their owners left them; a line
 * that was waiting to be decided about is at least as urgent as one that was
 * decided and parked.
 *
 * The ids are kept rather than minted. Two devices that each fold the same
 * payload must arrive at the same `backlog:<id>` entity, or the merge would
 * see two items where the person wrote one. And each folded line leaves an
 * `inbox:<id>` tombstone stamped now, so an older device that still holds
 * the line under its old name deletes its copy on the next merge instead of
 * handing it back.
 *
 * Returns the same object when there is nothing to fold - the pattern
 * `repairDuplicates` set - so the ordinary open, where the inbox has been
 * empty for months, costs one length check and never re-saves or re-renders
 * for nothing. Calling it twice is calling it once.
 */
export function foldInbox(data: AppData, now: string): AppData {
  if (data.inbox.length === 0) return data
  // A line whose id is already in Later has been folded on another device
  // and came back through a merge. The Later copy is the one that stands;
  // minting a second row for it would be the duplicate the kept id exists
  // to prevent.
  const already = new Set(data.backlog.map(item => item.id))
  const folded: LaterItem[] = []
  const tombstones: Record<string, string> = { ...(data.tombstones ?? {}) }
  for (const line of data.inbox) {
    tombstones[`inbox:${line.id}`] = now
    if (already.has(line.id)) continue
    const item: LaterItem = { id: line.id, title: line.text }
    if (line.updatedAt) item.updatedAt = line.updatedAt
    folded.push(item)
  }
  return { ...data, inbox: [], backlog: [...folded, ...data.backlog], tombstones }
}

/**
 * Drops a folded line that another device deleted under its old name.
 *
 * The fold runs at load, before the first merge, so a line that device A
 * deleted from its inbox while device B was away is already `backlog:<id>`
 * on B by the time A's `inbox:<id>` tombstone arrives - and nothing in the
 * merge relates the two names. B's own fold tombstone for the same key is
 * newer than A's, so the merge keeps B's, and the line A meant to be rid of
 * would stand in Later on both devices. So the remote's inbox tombstones are
 * read once more, raw, after the merge: an inbox tombstone newer than the
 * Later item's own last change is the deletion it always was, and the item
 * goes with a `backlog:<id>` tombstone of its own, so the next round trip
 * carries the deletion under the name every device reads now. An item the
 * person has touched since - moved, renamed - is newer than the tombstone
 * and stays, which is the same last-write-wins every entity keeps.
 *
 * Returns the same object when nothing is dropped, like `foldInbox`.
 */
export function dropDeletedFolds(
  data: AppData,
  remoteTombstones: Record<string, string> | undefined,
  now: string,
): AppData {
  if (!remoteTombstones) return data
  const gone = new Set<string>()
  for (const [key, at] of Object.entries(remoteTombstones)) {
    if (!key.startsWith('inbox:')) continue
    const id = key.slice('inbox:'.length)
    const item = data.backlog.find(i => i.id === id)
    if (item && (item.updatedAt ?? '') < at) gone.add(id)
  }
  if (gone.size === 0) return data
  const tombstones: Record<string, string> = { ...(data.tombstones ?? {}) }
  for (const id of gone) tombstones[`backlog:${id}`] = now
  return { ...data, backlog: data.backlog.filter(i => !gone.has(i.id)), tombstones }
}
