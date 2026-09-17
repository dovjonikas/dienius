import { addDays } from './dates'
import { isDayKind } from './dayKinds'
import type { AppData, Template } from './types'

/**
 * The roster's draft - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 2.5.
 *
 * A month is laid out by tapping dates and by filling a stretch with a cycle,
 * and none of it reaches the plan until Apply. What is laid out in between is
 * kept here: on this device, under its own key, outside `AppData`.
 *
 * **Not in the plan**, deliberately. A half-built month is not something to
 * sync, back up or export - it is one device's scratch of a rota that has not
 * been decided yet - and a draft in the plan would be a second answer to "what
 * kind is this date" for as long as it sat there. It has to outlive a reload,
 * though, because a month arrives from an employer as a photograph and is
 * typed in with the phone in the other hand.
 *
 * **Read defensively.** Nothing here is validated by the plan's guard, and the
 * key belongs to the device rather than to a file anybody keeps: whatever is
 * under it may be half-written, from a newer version, or from a hand in the
 * console. What does not read as a draft reads as no draft.
 */

const DRAFT_KEY = 'dienius:roster-draft'
const CYCLE_KEY = 'dienius:roster-cycle'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A date's kind while it is being laid out: a kind template's id, or null for none. */
export interface RosterDraft {
  dates: Record<string, string | null>
}

/** A sequence of kinds and the date it starts on - "D D N N R R R" from the 3rd. */
export interface RosterCycle {
  /** Kind template ids, in the order they come round. */
  kinds: string[]
  from: string
}

const EMPTY: RosterDraft = { dates: {} }

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

/** The draft this device is holding, or an empty one. */
export function readDraft(): RosterDraft {
  const held = read(DRAFT_KEY)
  if (!held || typeof held !== 'object') return EMPTY
  const dates = (held as { dates?: unknown }).dates
  if (!dates || typeof dates !== 'object' || Array.isArray(dates)) return EMPTY
  const kept: Record<string, string | null> = {}
  for (const [date, kind] of Object.entries(dates as Record<string, unknown>)) {
    if (!DATE.test(date)) continue
    if (kind === null || typeof kind === 'string') kept[date] = kind
  }
  return { dates: kept }
}

export function writeDraft(draft: RosterDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ dates: draft.dates }))
  } catch {
    // A device with no room left still lays a month out; it just forgets it on
    // the way back. Nothing here is worth failing a tap over.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // As above.
  }
}

/** The last cycle used on this device, because next month's is usually the same pattern moved on. */
export function readCycle(): RosterCycle | undefined {
  const held = read(CYCLE_KEY)
  if (!held || typeof held !== 'object') return undefined
  const { kinds, from } = held as { kinds?: unknown; from?: unknown }
  if (!Array.isArray(kinds) || !kinds.every(k => typeof k === 'string')) return undefined
  if (typeof from !== 'string' || !DATE.test(from)) return undefined
  return { kinds: kinds as string[], from }
}

export function writeCycle(cycle: RosterCycle): void {
  try {
    localStorage.setItem(CYCLE_KEY, JSON.stringify({ kinds: cycle.kinds, from: cycle.from }))
  } catch {
    // As above.
  }
}

/**
 * The dates a cycle fills, from where it starts through `until`, taking its
 * kinds in turn and round again. A sequence with nothing in it fills nothing,
 * and so does a stretch that ends before it starts.
 */
export function cycleDates(cycle: RosterCycle, until: string): Record<string, string> {
  const filled: Record<string, string> = {}
  if (cycle.kinds.length === 0) return filled
  let date = cycle.from
  for (let i = 0; date <= until; i++, date = addDays(date, 1)) {
    filled[date] = cycle.kinds[i % cycle.kinds.length]
  }
  return filled
}

/**
 * What kind a date is once the draft is read over the plan: the draft where it
 * has an answer for the date, the plan where it does not. A draft naming a
 * template that is no longer a kind is no kind, the way every dangling id in
 * this app degrades rather than throwing.
 */
export function kindAfterDraft(data: AppData, draft: RosterDraft, date: string): Template | undefined {
  const id = date in draft.dates ? draft.dates[date] : (data.days[date]?.templateId ?? null)
  if (!id) return undefined
  const template = data.templates.find(t => t.id === id)
  return template && isDayKind(template) ? template : undefined
}
