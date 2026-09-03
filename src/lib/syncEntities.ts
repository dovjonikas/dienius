import type { AppData, BacklogItem, DayPlan, Goal, IfThenEntry, InboxItem, LibraryItem, LibraryList, ScratchNote, Settings, Task, Template } from './types'

/**
 * State, seen as a bag of individually addressable things.
 *
 * Sync merges per entity rather than per state - see ARCHITECTURE.md section
 * 7 for why. That needs two things this module provides: a way to name every
 * entity, and a way to know which ones actually changed.
 *
 * The second one is the interesting decision. Sixty actions in `store.ts` all
 * change something; asking each to stamp the right entity is sixty chances to
 * forget, and the sixty-first action written next year forgets by default.
 * So nothing stamps anything by hand. `commit()` diffs the state going out
 * against the state coming in and stamps whatever moved - which is cheap on a
 * store of a few hundred entities, impossible to forget, and already correct
 * for actions that do not exist yet.
 */

export type EntityKind =
  | 'task'
  | 'day'
  | 'template'
  | 'list'
  | 'item'
  | 'goal'
  | 'ifthen'
  | 'inbox'
  | 'backlog'
  | 'scratch'
  | 'setting'

export type EntityKey = string

/** How long a deletion is remembered. See `pruneTombstones`. */
export const TOMBSTONE_TTL_DAYS = 90

export interface Entity {
  key: EntityKey
  kind: EntityKind
  /**
   * The object this entity came from, untouched.
   *
   * The store is immutable, so an entity nobody edited is the *same object*
   * between two states - and a reference check is free where serialising a
   * body is not. `stampChanges` compares these first and only builds a body
   * when they differ, which is what keeps a commit that changes one setting
   * from walking every task in the store.
   */
  ref: unknown
  /** Only computed when the references differ - see `bodyOf`. */
  bodyOf: () => unknown
  updatedAt?: string
}

export function keyFor(kind: EntityKind, id: string): EntityKey {
  return `${kind}:${id}`
}

export function kindOf(key: EntityKey): EntityKind | undefined {
  const kind = key.slice(0, key.indexOf(':'))
  return KINDS.includes(kind as EntityKind) ? (kind as EntityKind) : undefined
}

export function idOf(key: EntityKey): string {
  return key.slice(key.indexOf(':') + 1)
}

const KINDS: EntityKind[] = ['task', 'day', 'template', 'list', 'item', 'goal', 'ifthen', 'inbox', 'backlog', 'scratch', 'setting']

/**
 * Which settings fields are entities of their own.
 *
 * Listed rather than derived from the object, so a field added later is a
 * deliberate decision about whether it should travel between devices rather
 * than something that happens by accident either way. Everything in Settings
 * is on it today - see the exhaustiveness check below, which is what stops
 * the next field from quietly not being.
 */
export const SYNCED_SETTINGS = [
  'theme',
  'enabledWidgets',
  'sleepProfiles',
  'weekdayTemplates',
  'reminder',
  'taskReminder',
  'north',
  'northDismissedOn',
  'eveningClose',
  'timelineExpanded',
  'dayLayoutFocus',
  'density',
  'textScale',
  // The subscriptions travel; what they contain does not - see calendars.ts.
  // A calendar added on the PC should appear on the phone, but a week of
  // somebody's work meetings is not a plan worth carrying between devices and
  // is stale the moment it is written.
  'calendars',
] as const

/**
 * Settings that deliberately stay on the device they were set on. None so far.
 */
type LocalOnlySettings = never

/**
 * Compile-time exhaustiveness for the list above.
 *
 * A setting added to `Settings` and forgotten here would silently never travel
 * between devices, and nothing would fail - not a test, not a type, not a
 * merge. It would simply be a preference that does not sync, discovered
 * months later on a phone. This makes forgetting it a build error: a new
 * setting is either added to SYNCED_SETTINGS or named in LocalOnlySettings
 * above, and there is no third option.
 */
type UnaccountedSetting = Exclude<keyof Settings, (typeof SYNCED_SETTINGS)[number] | LocalOnlySettings>
const _everySettingIsAccountedFor: Record<UnaccountedSetting, never> = {}
void _everySettingIsAccountedFor

/** Strips the field the diff must not compare, and any undefined keys. */
function body<T extends object>(value: T, ...omit: string[]): unknown {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || omit.includes(k)) continue
    out[k] = v
  }
  return out
}

/**
 * Every entity in a state, keyed.
 *
 * A task carries the date it is on, so moving a task between days registers as
 * a change to that task - which it is, and which a merge on the other device
 * has to see.
 */
export function collectEntities(data: AppData): Map<EntityKey, Entity> {
  const out = new Map<EntityKey, Entity>()

  for (const [date, day] of Object.entries(data.days)) {
    out.set(keyFor('day', date), {
      key: keyFor('day', date),
      kind: 'day',
      ref: day,
      bodyOf: () => body(day, 'tasks', 'updatedAt'),
      updatedAt: day.updatedAt,
    })
    for (const task of day.tasks) {
      out.set(keyFor('task', task.id), {
        key: keyFor('task', task.id),
        kind: 'task',
        ref: task,
        // The date travels with the task, so moving one between days reads as
        // a change to that task - which it is.
        bodyOf: () => ({ ...(body(task, 'updatedAt') as object), date }),
        updatedAt: task.updatedAt,
      })
    }
  }

  for (const template of data.templates) {
    out.set(keyFor('template', template.id), {
      key: keyFor('template', template.id),
      kind: 'template',
      ref: template,
      bodyOf: () => body(template, 'updatedAt'),
      updatedAt: template.updatedAt,
    })
  }

  for (const list of data.library) {
    out.set(keyFor('list', list.id), {
      key: keyFor('list', list.id),
      kind: 'list',
      ref: list,
      bodyOf: () => body(list, 'items', 'updatedAt'),
      updatedAt: list.updatedAt,
    })
    for (const item of list.items) {
      out.set(keyFor('item', item.id), {
        key: keyFor('item', item.id),
        kind: 'item',
        ref: item,
        bodyOf: () => ({ ...(body(item, 'updatedAt') as object), listId: list.id }),
        updatedAt: item.updatedAt,
      })
    }
  }

  for (const goal of data.goals) {
    out.set(keyFor('goal', goal.id), {
      key: keyFor('goal', goal.id),
      kind: 'goal',
      ref: goal,
      bodyOf: () => body(goal, 'updatedAt'),
      updatedAt: goal.updatedAt,
    })
  }

  for (const entry of data.ifThens) {
    out.set(keyFor('ifthen', entry.id), {
      key: keyFor('ifthen', entry.id),
      kind: 'ifthen',
      ref: entry,
      bodyOf: () => body(entry, 'updatedAt'),
      updatedAt: entry.updatedAt,
    })
  }

  for (const item of data.inbox) {
    out.set(keyFor('inbox', item.id), {
      key: keyFor('inbox', item.id),
      kind: 'inbox',
      ref: item,
      bodyOf: () => body(item, 'updatedAt'),
      updatedAt: item.updatedAt,
    })
  }

  // Its own entity per item, the same grain as an inbox line. Two devices
  // adding to the backlog on the same evening must both keep what they added -
  // this is the list you reach for when a day has room, and losing half of it
  // to a merge would be the one failure that makes somebody stop using it.
  for (const item of data.backlog) {
    out.set(keyFor('backlog', item.id), {
      key: keyFor('backlog', item.id),
      kind: 'backlog',
      ref: item,
      bodyOf: () => body(item, 'updatedAt'),
      updatedAt: item.updatedAt,
    })
  }

  // A note is its own entity, the same grain as an inbox line: two devices
  // each writing a note in the same minute must both keep theirs.
  for (const note of data.scratch) {
    out.set(keyFor('scratch', note.id), {
      key: keyFor('scratch', note.id),
      kind: 'scratch',
      ref: note,
      bodyOf: () => body(note, 'updatedAt'),
      updatedAt: note.updatedAt,
    })
  }

  for (const field of SYNCED_SETTINGS) {
    const value = (data.settings as unknown as Record<string, unknown>)[field]
    if (value === undefined) continue
    out.set(keyFor('setting', field), {
      key: keyFor('setting', field),
      kind: 'setting',
      ref: value,
      bodyOf: () => value,
      updatedAt: data.settingsUpdatedAt?.[field],
    })
  }

  return out
}

/** Deep equality by serialisation, with object keys ordered so it is stable. */
export function sameBody(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
}

/**
 * Stamps everything that changed between two states, and records what was
 * removed.
 *
 * Called from `commit()` with the state before and the state after. Returns
 * the state after, with `updatedAt` written onto changed entities and
 * tombstones added for deletions.
 *
 * Entities whose body is identical are left untouched, including their old
 * timestamp: re-saving an unchanged task must not make it look newer than the
 * copy on another device that genuinely did change.
 */
export function stampChanges(previous: AppData, next: AppData, now: string): AppData {
  const changed = new Set<EntityKey>()
  const removed: EntityKey[] = []

  // Collection by collection, and each one short-circuits on a reference
  // check before anything is walked. This is the whole reason the store is
  // immutable: a commit that changes one settings field must not cost a walk
  // of every task, and here it costs twelve comparisons.
  if (previous.days !== next.days) diffDays(previous, next, changed, removed)
  diffList('template', previous.templates, next.templates, changed, removed)
  if (previous.library !== next.library) diffLibrary(previous, next, changed, removed)
  diffList('goal', previous.goals, next.goals, changed, removed)
  diffList('ifthen', previous.ifThens, next.ifThens, changed, removed)
  diffList('inbox', previous.inbox, next.inbox, changed, removed)
  diffList('backlog', previous.backlog, next.backlog, changed, removed)
  diffList('scratch', previous.scratch, next.scratch, changed, removed)
  diffSettings(previous, next, changed)

  if (changed.size === 0 && removed.length === 0) return next
  return applyStamps(next, changed, removed, now)
}

/** Same reference, or same content once serialised. */
function unchanged(a: unknown, b: unknown): boolean {
  return a === b || sameBody(a, b)
}

function diffDays(previous: AppData, next: AppData, changed: Set<EntityKey>, removed: EntityKey[]): void {
  const seenTasks = new Set<string>()

  for (const [date, day] of Object.entries(next.days)) {
    const old = previous.days[date]
    if (old !== day) {
      if (!old || day.updatedAt === undefined || !unchanged(bodyOfDay(old), bodyOfDay(day))) {
        changed.add(keyFor('day', date))
      }
      if (!old || old.tasks !== day.tasks) {
        for (const task of day.tasks) {
          const before = old?.tasks.find(t => t.id === task.id)
          if (before !== task || task.updatedAt === undefined || datesDiffer(previous, task.id, date)) {
            if (!before || task.updatedAt === undefined || !unchanged(bodyOfTask(before), bodyOfTask(task)) || datesDiffer(previous, task.id, date)) {
              changed.add(keyFor('task', task.id))
            }
          }
        }
      }
    }
    for (const task of day.tasks) seenTasks.add(task.id)
  }

  for (const [date, day] of Object.entries(previous.days)) {
    if (!(date in next.days)) removed.push(keyFor('day', date))
    for (const task of day.tasks) {
      if (!seenTasks.has(task.id)) removed.push(keyFor('task', task.id))
    }
  }
}

/** Whether a task sat on a different date before - a move is a change to it. */
function datesDiffer(previous: AppData, taskId: string, date: string): boolean {
  const day = previous.days[date]
  if (day?.tasks.some(t => t.id === taskId)) return false
  for (const [otherDate, other] of Object.entries(previous.days)) {
    if (otherDate === date) continue
    if (other.tasks.some(t => t.id === taskId)) return true
  }
  return false
}

function bodyOfDay(day: DayPlan): unknown {
  return body(day, 'tasks', 'updatedAt')
}

function bodyOfTask(task: Task): unknown {
  return body(task, 'updatedAt')
}

function diffList<T extends { id: string; updatedAt?: string }>(
  kind: EntityKind,
  before: T[],
  after: T[],
  changed: Set<EntityKey>,
  removed: EntityKey[],
): void {
  if (before === after) return
  const byId = new Map(before.map(x => [x.id, x]))
  for (const item of after) {
    const old = byId.get(item.id)
    if (old === item) continue
    if (!old || item.updatedAt === undefined || !unchanged(body(old, 'updatedAt'), body(item, 'updatedAt'))) {
      changed.add(keyFor(kind, item.id))
    }
  }
  const ids = new Set(after.map(x => x.id))
  for (const item of before) {
    if (!ids.has(item.id)) removed.push(keyFor(kind, item.id))
  }
}

function diffLibrary(previous: AppData, next: AppData, changed: Set<EntityKey>, removed: EntityKey[]): void {
  const before = new Map(previous.library.map(l => [l.id, l]))
  const seenItems = new Set<string>()

  for (const list of next.library) {
    const old = before.get(list.id)
    if (old !== list) {
      if (!old || list.updatedAt === undefined || !unchanged(body(old, 'items', 'updatedAt'), body(list, 'items', 'updatedAt'))) {
        changed.add(keyFor('list', list.id))
      }
      const oldItems = new Map((old?.items ?? []).map(i => [i.id, i]))
      for (const item of list.items) {
        const previousItem = oldItems.get(item.id)
        if (previousItem === item) continue
        if (!previousItem || item.updatedAt === undefined || !unchanged(body(previousItem, 'updatedAt'), body(item, 'updatedAt'))) {
          changed.add(keyFor('item', item.id))
        }
      }
    }
    for (const item of list.items) seenItems.add(item.id)
  }

  const listIds = new Set(next.library.map(l => l.id))
  for (const list of previous.library) {
    if (!listIds.has(list.id)) removed.push(keyFor('list', list.id))
    for (const item of list.items) {
      if (!seenItems.has(item.id)) removed.push(keyFor('item', item.id))
    }
  }
}

function diffSettings(previous: AppData, next: AppData, changed: Set<EntityKey>): void {
  const before = previous.settings as unknown as Record<string, unknown>
  const after = next.settings as unknown as Record<string, unknown>
  for (const field of SYNCED_SETTINGS) {
    if (after[field] === undefined) continue
    const stamped = next.settingsUpdatedAt?.[field] !== undefined
    if (before[field] === after[field] && stamped) continue
    if (!stamped || !unchanged(before[field], after[field])) changed.add(keyFor('setting', field))
  }
}

/**
 * Maps a list, and hands back the very same array when nothing in it moved.
 *
 * Identity matters here for two reasons that both showed up the moment this
 * was wired in: components memoised on `data.templates` re-render when the
 * array is new, and rebuilding every collection on every commit turned a
 * theme switch - which touches one settings field - into a full walk of the
 * store. Changing a colour must not allocate a new copy of every task.
 */
function mapIfChanged<T extends { updatedAt?: string }>(
  list: T[],
  changed: (value: T) => boolean,
  now: string,
): T[] {
  let moved = false
  const out = list.map(value => {
    const next = stampOne(value, changed(value), now)
    if (next !== value) moved = true
    return next
  })
  return moved ? out : list
}

function applyStamps(data: AppData, changed: Set<EntityKey>, removed: EntityKey[], now: string): AppData {
  const touched = (kind: EntityKind, id: string) => changed.has(keyFor(kind, id))

  let daysMoved = false
  const days: Record<string, DayPlan> = {}
  for (const [date, day] of Object.entries(data.days)) {
    const tasks = mapIfChanged<Task>(day.tasks, task => touched('task', task.id), now)
    const dayStamp = touched('day', date) || day.updatedAt === undefined ? now : day.updatedAt
    if (tasks === day.tasks && dayStamp === day.updatedAt) {
      days[date] = day
      continue
    }
    daysMoved = true
    days[date] = { ...day, updatedAt: dayStamp, tasks }
  }

  const settingsUpdatedAt = { ...(data.settingsUpdatedAt ?? {}) }
  for (const field of SYNCED_SETTINGS) {
    if (touched('setting', field)) settingsUpdatedAt[field] = now
  }

  const tombstones = { ...(data.tombstones ?? {}) }
  for (const key of removed) tombstones[key] = now
  // A key that came back - undeleted, or re-created with the same id - must
  // lose its tombstone, or the next merge would delete it again.
  for (const key of changed) delete tombstones[key]

  let libraryMoved = false
  const library = data.library.map(list => {
    const items = mapIfChanged<LibraryItem>(list.items, item => touched('item', item.id), now)
    const stamped = stampOne<LibraryList>(list, touched('list', list.id), now)
    if (items === list.items && stamped === list) return list
    libraryMoved = true
    return { ...stamped, items }
  })

  return {
    ...data,
    days: daysMoved ? days : data.days,
    library: libraryMoved ? library : data.library,
    templates: mapIfChanged<Template>(data.templates, t => touched('template', t.id), now),
    goals: mapIfChanged<Goal>(data.goals, g => touched('goal', g.id), now),
    ifThens: mapIfChanged<IfThenEntry>(data.ifThens, e => touched('ifthen', e.id), now),
    inbox: mapIfChanged<InboxItem>(data.inbox, i => touched('inbox', i.id), now),
    backlog: mapIfChanged<BacklogItem>(data.backlog, i => touched('backlog', i.id), now),
    scratch: mapIfChanged<ScratchNote>(data.scratch, n => touched('scratch', n.id), now),
    settingsUpdatedAt,
    tombstones: pruneTombstones(tombstones, now),
  }
}

function stampOne<T extends { updatedAt?: string }>(value: T, changed: boolean, now: string): T {
  return changed || value.updatedAt === undefined ? { ...value, updatedAt: now } : value
}

/**
 * Drops deletions older than the window.
 *
 * A device offline for longer than this would resurrect what it still holds,
 * which is the honest trade for not growing the file forever. Ninety days is
 * far longer than any gap this app's owner will have between opening it on
 * two devices.
 */
export function pruneTombstones(tombstones: Record<string, string>, now: string): Record<string, string> {
  const cutoff = new Date(new Date(now).getTime() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString()
  const out: Record<string, string> = {}
  for (const [key, at] of Object.entries(tombstones)) {
    if (at >= cutoff) out[key] = at
  }
  return out
}
