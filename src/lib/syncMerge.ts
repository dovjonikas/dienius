import type { AppData, DayPlan, Goal, IfThenEntry, InboxItem, LibraryItem, LibraryList, Task, Template } from './types'
import { SYNCED_SETTINGS, collectEntities, idOf, keyFor, kindOf, pruneTombstones, type EntityKey } from './syncEntities'

/**
 * Merging two states, one entity at a time.
 *
 * The whole of sync's correctness is here, and it is one rule applied nine
 * times: for each entity, keep whichever side changed later; a deletion is
 * just another dated fact and wins if it is the later one.
 *
 * What this is built to survive is the ordinary case, not an exotic one:
 * three things ticked off on a phone at breakfast, a template edited on a PC
 * that evening, and neither device having seen the other in between. A
 * whole-state last-write-wins loses one of those completely. Per entity, both
 * survive, because they are not the same entity.
 *
 * Everything here is pure, and nothing here throws. A remote state that makes
 * no sense is rejected before it reaches this - see `isSyncableState` - and
 * the worst outcome of a server that has gone wrong must be "no sync", never
 * "no data".
 */

export interface MergeResult {
  data: AppData
  /** How many entities the remote side supplied that were newer. */
  applied: number
  /** How many local entities the remote side deleted. */
  deleted: number
}

/** ISO instants sort lexically, so a string compare is the whole comparison. */
function newer(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined) return false
  if (b === undefined) return true
  return a > b
}

/**
 * The instant an entity was last touched on one side, deletion included.
 *
 * A tombstone is a fact with a date on it, exactly like an edit, so the two
 * compare directly - which is what makes "deleted on the phone at 9, edited
 * on the PC at 8" resolve the way anybody would expect.
 */
function stampOf(data: AppData, key: EntityKey, entities: Map<EntityKey, { updatedAt?: string }>): string | undefined {
  const tomb = data.tombstones?.[key]
  const live = entities.get(key)?.updatedAt
  if (tomb && live) return tomb > live ? tomb : live
  return tomb ?? live
}

function isDeleted(data: AppData, key: EntityKey, entities: Map<EntityKey, { updatedAt?: string }>): boolean {
  const tomb = data.tombstones?.[key]
  if (!tomb) return false
  const live = entities.get(key)?.updatedAt
  return !live || tomb > live
}

/**
 * Local plus remote, per entity.
 *
 * Reads as a series of "which side wins for this key" decisions and then
 * rebuilds the state from the winners. Rebuilding rather than patching is
 * deliberate: a patch has to think about ordering and about entities that
 * moved between parents, and this does not.
 */
export function mergeStates(local: AppData, remote: AppData, now: string): MergeResult {
  const localEntities = collectEntities(local)
  const remoteEntities = collectEntities(remote)
  const keys = new Set<EntityKey>([
    ...localEntities.keys(),
    ...remoteEntities.keys(),
    ...Object.keys(local.tombstones ?? {}),
    ...Object.keys(remote.tombstones ?? {}),
  ])

  /** For each key: which side to take it from, or that it is gone. */
  const winner = new Map<EntityKey, 'local' | 'remote' | 'deleted'>()
  const tombstones: Record<string, string> = { ...(local.tombstones ?? {}) }
  let applied = 0
  let deleted = 0

  for (const key of keys) {
    const localAt = stampOf(local, key, localEntities)
    const remoteAt = stampOf(remote, key, remoteEntities)
    const takeRemote = newer(remoteAt, localAt)

    const gone = takeRemote ? isDeleted(remote, key, remoteEntities) : isDeleted(local, key, localEntities)
    if (gone) {
      const at = takeRemote ? remote.tombstones?.[key] : local.tombstones?.[key]
      if (at) tombstones[key] = at
      if (localEntities.has(key)) deleted++
      winner.set(key, 'deleted')
      continue
    }

    // A live winner clears any tombstone: the entity came back, or was never
    // really gone on the side that knows most about it.
    if (takeRemote && remoteEntities.has(key)) {
      delete tombstones[key]
      winner.set(key, 'remote')
      applied++
    } else if (localEntities.has(key)) {
      if (!isDeleted(local, key, localEntities)) delete tombstones[key]
      winner.set(key, 'local')
    } else if (remoteEntities.has(key)) {
      // Nothing local at all: take it, whatever the timestamps say. A missing
      // entity has no opinion.
      delete tombstones[key]
      winner.set(key, 'remote')
      applied++
    }
  }

  const data = rebuild(local, remote, winner)
  return { data: { ...data, tombstones: pruneTombstones(tombstones, now) }, applied, deleted }
}

function pick<T>(
  key: EntityKey,
  winner: Map<EntityKey, 'local' | 'remote' | 'deleted'>,
  fromLocal: T | undefined,
  fromRemote: T | undefined,
): T | undefined {
  const side = winner.get(key)
  if (side === 'deleted') return undefined
  if (side === 'remote') return fromRemote
  if (side === 'local') return fromLocal
  return undefined
}

function rebuild(local: AppData, remote: AppData, winner: Map<EntityKey, 'local' | 'remote' | 'deleted'>): AppData {
  // --- tasks, and the day each one lives on ------------------------------
  const localTasks = tasksByKey(local)
  const remoteTasks = tasksByKey(remote)
  const tasksByDate = new Map<string, Task[]>()

  for (const key of new Set([...localTasks.keys(), ...remoteTasks.keys()])) {
    const chosen = pick(key, winner, localTasks.get(key), remoteTasks.get(key))
    if (!chosen) continue
    const list = tasksByDate.get(chosen.date) ?? []
    list.push(chosen.task)
    tasksByDate.set(chosen.date, list)
  }

  // --- day meta ----------------------------------------------------------
  const days: Record<string, DayPlan> = {}
  const dayDates = new Set([...Object.keys(local.days), ...Object.keys(remote.days), ...tasksByDate.keys()])
  for (const date of dayDates) {
    const meta = pick(keyFor('day', date), winner, local.days[date], remote.days[date])
    const tasks = tasksByDate.get(date) ?? []
    // A day with no meta and no tasks is nothing at all - dropping it keeps
    // the store from filling with empty shells for every date ever opened.
    if (!meta && tasks.length === 0) continue
    days[date] = { ...(meta ?? { date, tasks: [] }), date, tasks: orderTasks(tasks, local.days[date], remote.days[date]) }
  }

  // --- library, which is two levels --------------------------------------
  const listIds = new Set([...local.library.map(l => l.id), ...remote.library.map(l => l.id)])
  const itemsByList = new Map<string, LibraryItem[]>()
  const localItems = itemsByKey(local)
  const remoteItems = itemsByKey(remote)
  for (const key of new Set([...localItems.keys(), ...remoteItems.keys()])) {
    const chosen = pick(key, winner, localItems.get(key), remoteItems.get(key))
    if (!chosen) continue
    const list = itemsByList.get(chosen.listId) ?? []
    list.push(chosen.item)
    itemsByList.set(chosen.listId, list)
  }

  const library: LibraryList[] = []
  for (const id of listIds) {
    const meta = pick(
      keyFor('list', id),
      winner,
      local.library.find(l => l.id === id),
      remote.library.find(l => l.id === id),
    )
    if (!meta) continue
    library.push({ ...meta, items: itemsByList.get(id) ?? [] })
  }

  return {
    ...local,
    days,
    library,
    templates: mergeList<Template>('template', winner, local.templates, remote.templates),
    goals: mergeList<Goal>('goal', winner, local.goals, remote.goals),
    ifThens: mergeList<IfThenEntry>('ifthen', winner, local.ifThens, remote.ifThens),
    inbox: mergeList<InboxItem>('inbox', winner, local.inbox, remote.inbox),
    ...mergeSettings(local, remote, winner),
  }
}

/**
 * Task order within a day.
 *
 * The day view sorts for display anyway, so this only has to be stable and
 * unsurprising: whichever side already knew about a task decides where it
 * sits, local first, and anything new is appended. Sorting here would fight
 * `sortTasks`, which is the one place that decision belongs.
 */
function orderTasks(tasks: Task[], localDay: DayPlan | undefined, remoteDay: DayPlan | undefined): Task[] {
  const order = new Map<string, number>()
  let n = 0
  for (const id of [...(localDay?.tasks ?? []), ...(remoteDay?.tasks ?? [])].map(t => t.id)) {
    if (!order.has(id)) order.set(id, n++)
  }
  return tasks.slice().sort((a, b) => (order.get(a.id) ?? n) - (order.get(b.id) ?? n))
}

function mergeList<T extends { id: string }>(
  kind: 'template' | 'goal' | 'ifthen' | 'inbox',
  winner: Map<EntityKey, 'local' | 'remote' | 'deleted'>,
  localList: T[],
  remoteList: T[],
): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const item of [...localList, ...remoteList]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const chosen = pick(
      keyFor(kind, item.id),
      winner,
      localList.find(x => x.id === item.id),
      remoteList.find(x => x.id === item.id),
    )
    if (chosen) out.push(chosen)
  }
  return out
}

function mergeSettings(
  local: AppData,
  remote: AppData,
  winner: Map<EntityKey, 'local' | 'remote' | 'deleted'>,
): Pick<AppData, 'settings' | 'settingsUpdatedAt'> {
  const settings = { ...local.settings } as unknown as Record<string, unknown>
  const stamps = { ...(local.settingsUpdatedAt ?? {}) }

  for (const field of SYNCED_SETTINGS) {
    if (winner.get(keyFor('setting', field)) !== 'remote') continue
    const value = (remote.settings as unknown as Record<string, unknown>)[field]
    if (value === undefined) continue
    settings[field] = value
    const at = remote.settingsUpdatedAt?.[field]
    if (at) stamps[field] = at
  }

  return { settings: settings as unknown as AppData['settings'], settingsUpdatedAt: stamps }
}

function tasksByKey(data: AppData): Map<EntityKey, { task: Task; date: string }> {
  const out = new Map<EntityKey, { task: Task; date: string }>()
  for (const [date, day] of Object.entries(data.days)) {
    for (const task of day.tasks) out.set(keyFor('task', task.id), { task, date })
  }
  return out
}

function itemsByKey(data: AppData): Map<EntityKey, { item: LibraryItem; listId: string }> {
  const out = new Map<EntityKey, { item: LibraryItem; listId: string }>()
  for (const list of data.library) {
    for (const item of list.items) out.set(keyFor('item', item.id), { item, listId: list.id })
  }
  return out
}

/**
 * Whether a payload from the server is a state this app can merge with.
 *
 * Deliberately shallow. The full `validate` in storage.ts is the right gate
 * for an imported backup, where a bad file should be rejected outright; here
 * the cost of being wrong is different, and the rule is "if in doubt, do not
 * touch the local copy". Anything that fails this is reported as an error and
 * ignored entirely.
 */
export function isSyncableState(x: unknown): x is AppData {
  if (typeof x !== 'object' || x === null) return false
  const s = x as Record<string, unknown>
  if (typeof s.days !== 'object' || s.days === null || Array.isArray(s.days)) return false
  if (!Array.isArray(s.templates)) return false
  if (typeof s.settings !== 'object' || s.settings === null) return false
  for (const field of ['library', 'goals', 'ifThens', 'inbox'] as const) {
    if (s[field] !== undefined && !Array.isArray(s[field])) return false
  }
  if (s.tombstones !== undefined && (typeof s.tombstones !== 'object' || s.tombstones === null)) return false
  return true
}

/**
 * Fills in the collections an older or partial payload may be missing, so the
 * merge never has to check. Anything absent is treated as "this side has
 * nothing to say about that", which is exactly what an empty list means here.
 */
export function normaliseRemote(remote: AppData): AppData {
  return {
    ...remote,
    days: remote.days ?? {},
    templates: remote.templates ?? [],
    library: remote.library ?? [],
    goals: remote.goals ?? [],
    ifThens: remote.ifThens ?? [],
    inbox: remote.inbox ?? [],
    tombstones: remote.tombstones ?? {},
    settingsUpdatedAt: remote.settingsUpdatedAt ?? {},
  }
}

/** Only used by the tests and by the client's own logging. */
export function entityKinds(): string[] {
  return ['task', 'day', 'template', 'list', 'item', 'goal', 'ifthen', 'inbox', 'setting']
}

export { idOf, kindOf }
