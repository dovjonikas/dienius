import { ROUTINE_LIMITS, type AppData, type Template } from './types'

/**
 * Kinds of day on the roster - rotating shifts, since v2.29, and
 * docs/RESEARCH-SHIFTS.md section 2. A kind is a day template carrying a
 * `DayKindMark`; the roster is the stamps, so a date's kind is the kind
 * template stamped on it. Everything that asks "is this a kind", "which kinds
 * are there" or "what kind is this date" asks here.
 */

/** Whether a template is a kind of day: a day template with a mark. */
export function isDayKind(template: Template): boolean {
  return !!template.dayKind && template.kind !== 'week'
}

/** Every kind, in the order a tap walks them; a tie in order falls back to the name. */
export function dayKinds(templates: Template[]): Template[] {
  return templates
    .filter(isDayKind)
    .sort((a, b) => a.dayKind!.order - b.dayKind!.order || a.name.localeCompare(b.name))
}

/**
 * The kind a date is: the kind template stamped on it. A day with an ordinary
 * template, a template id that names nothing, or no day at all has no kind -
 * a dangling id degrades like every other.
 */
export function kindOnDate(data: AppData, date: string): Template | undefined {
  const id = data.days[date]?.templateId
  if (!id) return undefined
  const template = data.templates.find(t => t.id === id)
  return template && isDayKind(template) ? template : undefined
}

/** Whether a kind's days are nights: its day type, which is what the night's own hours are read from. */
export function isNightKind(template: Template | undefined): boolean {
  return !!template && isDayKind(template) && template.type === 'night'
}

/**
 * The kind a date is given, read against the kind of the date before it -
 * docs/RESEARCH-SHIFTS.md section 2.6. A kind naming an `afterNight` is that
 * kind on a date after a night; on any other date it is itself. With
 * `reverse`, the way back as well: a kind that stands in for exactly one
 * other, on a date that no longer follows a night, is that other kind again
 * - which is asked only for a date whose neighbour changed, never of a kind
 * somebody wrote on a date themselves. A kind naming itself, or a template
 * that is no kind any more, names nothing, and two kinds naming the same one
 * leave the way back unguessed.
 */
export function resolveAfterNight(templates: Template[], kind: Template, before: Template | undefined, opts: { reverse?: boolean } = {}): Template {
  const kinds = dayKinds(templates)
  if (isNightKind(before)) {
    const id = kind.dayKind?.afterNight
    const named = id && id !== kind.id ? kinds.find(k => k.id === id) : undefined
    return named ?? kind
  }
  if (!opts.reverse) return kind
  const bases = kinds.filter(k => k.id !== kind.id && k.dayKind!.afterNight === kind.id)
  return bases.length === 1 ? bases[0] : kind
}

/**
 * The kind a tap on a date moves to: the next in order, round to the first
 * after the last, and the first from a date with no kind - or with something
 * that is not a kind any more. A tap never clears a date; clearing is its own
 * gesture. Undefined only when there are no kinds at all.
 */
export function nextKind(templates: Template[], currentId: string | undefined): Template | undefined {
  const kinds = dayKinds(templates)
  if (kinds.length === 0) return undefined
  const at = kinds.findIndex(k => k.id === currentId)
  return kinds[(at + 1) % kinds.length]
}

/**
 * A kind's letter as it is kept: trimmed, in capitals so it reads on a date at
 * a glance, and cut to `ROUTINE_LIMITS.letter` characters. Empty means no mark.
 */
export function cleanLetter(letter: string): string {
  return letter.trim().toUpperCase().slice(0, ROUTINE_LIMITS.letter)
}
