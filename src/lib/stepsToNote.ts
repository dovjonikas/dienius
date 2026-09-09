/**
 * The one-way door out of steps.
 *
 * Steps and subtasks were a list beside a note - a template block could carry
 * both, and so could a task. In a year of use the list was never the thing
 * anybody reached for; the note was. So there is one place text goes now, and
 * this is what happens to the lists that already exist.
 *
 * **Nothing is lost.** Every step becomes a line at the end of the note it
 * sat beside, written the way somebody would have typed it: `- Water`, and
 * `- Meditation (10 min)` where it carried a length. A block that had a note
 * and a list keeps both, with a blank line between them.
 *
 * **It runs twice safely**, which matters because it runs on every load and
 * on every import: a line already in the note is not added again, so a file
 * that was migrated, exported and imported comes back the same rather than
 * doubled. That is a stronger promise than "the field is gone after the
 * first run" - it holds for a half-migrated file too.
 *
 * Where it runs: `normalizeLoaded` in `storage.ts`, which is the one gate
 * both `loadData` and `importJson` pass through.
 */

/** What a step looked like on either side. */
export interface LegacyStep {
  title?: unknown
  minutes?: unknown
}

/** One step, as the line a person would have written. */
export function stepLine(step: LegacyStep): string | null {
  const title = typeof step.title === 'string' ? step.title.trim() : ''
  if (!title) return null
  const minutes = typeof step.minutes === 'number' && Number.isFinite(step.minutes) ? step.minutes : undefined
  return minutes === undefined ? `- ${title}` : `- ${title} (${minutes} min)`
}

/**
 * A note with a list folded into the end of it.
 *
 * Returns the note unchanged when there is nothing to fold, so a caller can
 * compare by identity to know whether anything happened.
 */
export function foldStepsIntoNote(note: string | undefined, steps: unknown): string | undefined {
  if (!Array.isArray(steps) || steps.length === 0) return note
  const lines = steps
    .map(step => (step && typeof step === 'object' ? stepLine(step as LegacyStep) : null))
    .filter((line): line is string => line !== null)
  if (lines.length === 0) return note

  const existing = note ?? ''
  // Already there is already there. A step whose line the note carries is a
  // step that has been folded in once, whatever the field beside it says.
  const already = new Set(existing.split(/\r\n|\r|\n/).map(l => l.trim()))
  const fresh = lines.filter(line => !already.has(line))
  if (fresh.length === 0) return existing === '' ? undefined : existing

  // A blank line between what was written and what was a list, so the two do
  // not read as one paragraph.
  return existing.trim() === '' ? fresh.join('\n') : `${existing.replace(/\s+$/, '')}\n\n${fresh.join('\n')}`
}

/**
 * Every task and template block in a payload, with its steps folded into its
 * note and the field itself removed.
 *
 * Takes and returns loose objects rather than typed ones: it runs on a file
 * that has just been parsed and may hold fields the types no longer name,
 * which is the whole reason it exists.
 */
export function foldLegacySteps<T>(data: T): T {
  const payload = data as unknown as {
    days?: Record<string, { tasks?: Record<string, unknown>[] }>
    templates?: { blocks?: Record<string, unknown>[] }[]
    backlog?: Record<string, unknown>[]
  }

  const fold = (item: Record<string, unknown>, field: 'steps' | 'subtasks') => {
    if (!(field in item)) return item
    const note = foldStepsIntoNote(typeof item.note === 'string' ? item.note : undefined, item[field])
    const next = { ...item }
    delete next[field]
    if (note !== undefined) next.note = note
    return next
  }

  const days = payload.days
    ? Object.fromEntries(
        Object.entries(payload.days).map(([key, day]) => [
          key,
          { ...day, tasks: (day?.tasks ?? []).map(task => fold(task, 'subtasks')) },
        ]),
      )
    : payload.days

  const templates = payload.templates?.map(template => ({
    ...template,
    blocks: (template?.blocks ?? []).map(block => fold(block, 'steps')),
  }))

  // Later carries tasks too, and a task pushed off a day took its list with
  // it - see `later.ts`.
  const backlog = payload.backlog?.map(item => fold(item, 'subtasks'))

  return {
    ...(data as object),
    ...(days ? { days } : {}),
    ...(templates ? { templates } : {}),
    ...(backlog ? { backlog } : {}),
  } as T
}
