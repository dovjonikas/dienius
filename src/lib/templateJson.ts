import { MEAL_TYPES, ROUTINE_LIMITS, type AppData, type DayType, type MealType, type Routine, type SleepProfile, type Template, type TemplateBlock } from './types'
import { PALETTE_COLORS } from './colors'
import { cleanLetter, dayKinds, isDayKind, kindOnDate } from './dayKinds'
import { rosterApplied } from './shiftDay'
import { sameName } from './recipeImport'
import { mealFields } from './kitchen'
import { cleanRoutine, routineMinutes, type RoutineInput } from './routines'
import { currentItem } from './library'
import { keepTodayAsLived, refreshStampedDays } from './reimport'

/**
 * Templates and the roster as JSON - since v2.33, docs/TEMPLATE-JSON.md.
 *
 * For a set of day templates and a roster written somewhere else - by the
 * person, or by another agent - and handed to the app as one text, and for
 * the same text back out. The contract is the document; this is the reading
 * and the writing of it.
 *
 * `readTemplatesJson` is pure: it reads a text against a plan and returns
 * what it will do - every template new, updated, unchanged or skipped, every
 * date the same, every note - and the plan it makes, which Apply commits as
 * it is. One entry that cannot be read never stops the rest. The roster goes
 * through `rosterApplied`, the path the Roster's own Apply takes, so a date is
 * composed with its routines and its sleep and the dates around it follow.
 *
 * `templatesJson` writes the plan's templates and roster in the same format,
 * the same text for the same plan: exported, imported and exported again, it
 * is the same character for character.
 */

export const TEMPLATE_JSON_FORMAT = 'dienius-templates'
export const TEMPLATE_JSON_VERSION = 1

const DAY_TYPES: readonly DayType[] = ['full', 'shift', 'night', 'rest']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const COLOR = /^#[0-9a-f]{6}$/i
const LIMITS = { name: 120, title: 200, minutes: 1440 } as const

const FILE_FIELDS = ['format', 'version', 'templates', 'routines', 'roster']
const ROUTINE_FIELDS = ['title', 'minutes', 'category', 'core', 'weekdays', 'times']
const TEMPLATE_FIELDS = ['name', 'type', 'kind', 'afterNight', 'color', 'sleep', 'blocks']
const BLOCK_FIELDS = ['time', 'title', 'minutes', 'category', 'core', 'key', 'ongoing', 'afterMidnight', 'mealType', 'followMeal', 'recipes', 'library', 'note']

// ---- writing ------------------------------------------------------------------------------------

type Entry = Record<string, unknown>

/** A block as the file writes it: the contract's fields, in its order, each only when it says something. */
function blockEntry(block: TemplateBlock, data: AppData): Entry {
  const out: Entry = {}
  if (block.time) out.time = block.time
  out.title = block.title
  if (block.minutes !== undefined) out.minutes = block.minutes
  const category = block.category ? data.categories.find(c => c.id === block.category) : undefined
  if (category) out.category = category.label
  if (block.core) out.core = true
  if (block.highlight) out.key = true
  if (block.unbounded) out.ongoing = true
  if (block.afterMidnight) out.afterMidnight = true
  const ids = block.recipeIds?.length ? block.recipeIds : block.recipeId ? [block.recipeId] : []
  const found = ids.flatMap(id => data.recipes.filter(r => r.id === id).map(r => r.title))
  if (found.length === 0 && block.mealType) {
    out.mealType = block.mealType
    if (block.followMeal) out.followMeal = true
  }
  // The names still waiting for Kitchen after the ones it has, so a file
  // exported before its recipes arrived still names them.
  const recipes = [...found, ...(block.waitingRecipes ?? [])]
  if (recipes.length > 0) out.recipes = recipes
  // The list it reads from, by its name - or the name it still waits for,
  // so a file exported before its shelf still names it. A list deleted since
  // leaves an id that names nothing, and nothing is written.
  const list = block.libraryListId ? data.library.find(l => l.id === block.libraryListId) : undefined
  if (list) out.library = list.name
  else if (block.waitingLibrary) out.library = block.waitingLibrary
  if (block.note) out.note = block.note
  return out
}

/** A template as the file writes it. No `type` for a full day, no `sleep` for the first schedule. */
function templateEntry(template: Template, data: AppData): Entry {
  const out: Entry = { name: template.name }
  if (template.type && template.type !== 'full') out.type = template.type
  if (isDayKind(template)) out.kind = template.dayKind!.letter
  // The kind it is after a night, by that kind's letter - section 2.6.
  if (isDayKind(template) && template.dayKind!.afterNight) {
    const after = dayKinds(data.templates).find(k => k.id === template.dayKind!.afterNight)
    if (after && after.id !== template.id) out.afterNight = after.dayKind!.letter
  }
  out.color = template.color
  const first = data.settings.sleepProfiles[0]
  const profile =
    template.sleepProfileId && template.sleepProfileId !== first?.id
      ? data.settings.sleepProfiles.find(p => p.id === template.sleepProfileId)
      : undefined
  if (profile) out.sleep = { from: profile.window.start, to: profile.window.end }
  out.blocks = template.blocks.map(block => blockEntry(block, data))
  return out
}

/**
 * A routine as the file writes it: its length one number, or one per kind
 * where it has them; its weekdays 1 to 7 with Monday first; its times by the
 * kinds' letters, in the roster's order.
 */
function routineEntry(routine: Routine, kinds: readonly Template[], data: AppData): Entry {
  const out: Entry = { title: routine.title }
  const perKind = Object.keys(routine.kindMinutes ?? {}).length > 0
  out.minutes = perKind
    ? Object.fromEntries(kinds.map(k => [k.dayKind!.letter, routineMinutes(routine, k.id)]))
    : routine.minutes
  const category = routine.category ? data.categories.find(c => c.id === routine.category) : undefined
  if (category) out.category = category.label
  if (routine.core) out.core = true
  out.weekdays = [...new Set(routine.weekdays)].map(day => (day === 0 ? 7 : day)).sort((a, b) => a - b)
  out.times = Object.fromEntries(kinds.flatMap(k => (routine.times[k.id] ? [[k.dayKind!.letter, routine.times[k.id]]] : [])))
  return out
}

/** An object on one line, the way the file writes a block, a sleep and a routine. */
function inline(entry: Entry): string {
  return `{ ${Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${inlineValue(value)}`).join(', ')} }`
}

/**
 * One value on that line. A list and an object are written with the line's
 * own spacing - `[1, 3, 5]`, `{ "D": "20:10" }` - rather than
 * `JSON.stringify`'s, so a routine's weekdays and its times read the way
 * the rest of the line does.
 */
function inlineValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => JSON.stringify(item)).join(', ')}]`
  if (value !== null && typeof value === 'object') {
    return `{ ${Object.entries(value as Record<string, unknown>).map(([key, inner]) => `${JSON.stringify(key)}: ${JSON.stringify(inner)}`).join(', ')} }`
  }
  return JSON.stringify(value)
}

/** The day templates in the order the file writes them: the kinds in the roster's order, then the rest by name. */
function inFileOrder(templates: readonly Template[]): Template[] {
  const others = templates.filter(t => t.kind !== 'week' && !isDayKind(t)).sort((a, b) => a.name.localeCompare(b.name))
  return [...dayKinds([...templates]), ...others]
}

/** The plan's templates and its roster from today on, in the contract's format. */
export function templatesJson(data: AppData, today: string): string {
  const templates = inFileOrder(data.templates).map(t => templateEntry(t, data))
  const kinds = dayKinds([...data.templates])
  const routines = data.routines.map(r => routineEntry(r, kinds, data))
  const roster = Object.keys(data.days)
    .filter(date => date >= today)
    .sort()
    .flatMap(date => {
      const kind = kindOnDate(data, date)
      return kind ? [[date, kind.dayKind!.letter] as const] : []
    })

  const out = ['{', `  "format": ${JSON.stringify(TEMPLATE_JSON_FORMAT)},`, `  "version": ${TEMPLATE_JSON_VERSION},`]
  if (templates.length === 0) out.push('  "templates": [],')
  else {
    out.push('  "templates": [')
    templates.forEach((template, i) => {
      out.push('    {')
      const fields = Object.entries(template)
      fields.forEach(([key, value], j) => {
        const comma = j < fields.length - 1 ? ',' : ''
        if (key === 'blocks') {
          const blocks = value as Entry[]
          if (blocks.length === 0) out.push(`      "blocks": []${comma}`)
          else {
            out.push('      "blocks": [')
            blocks.forEach((block, n) => out.push(`        ${inline(block)}${n < blocks.length - 1 ? ',' : ''}`))
            out.push(`      ]${comma}`)
          }
        } else if (key === 'sleep') out.push(`      "sleep": ${inline(value as Entry)}${comma}`)
        else out.push(`      ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`)
      })
      out.push(`    }${i < templates.length - 1 ? ',' : ''}`)
    })
    out.push('  ],')
  }
  if (routines.length === 0) out.push('  "routines": [],')
  else {
    out.push('  "routines": [')
    routines.forEach((routine, i) => out.push(`    ${inline(routine)}${i < routines.length - 1 ? ',' : ''}`))
    out.push('  ],')
  }
  if (roster.length === 0) out.push('  "roster": {}')
  else {
    out.push('  "roster": {')
    roster.forEach(([date, letter], i) => out.push(`    ${JSON.stringify(date)}: ${JSON.stringify(letter)}${i < roster.length - 1 ? ',' : ''}`))
    out.push('  }')
  }
  out.push('}')
  return out.join('\n') + '\n'
}

// ---- reading ------------------------------------------------------------------------------------

/** What Apply will do to one template of the file. */
export interface TemplateRow {
  /** Its name as the file writes it, or its place in the file when it has none. */
  name: string
  action: 'create' | 'update' | 'unchanged' | 'skip'
  notes: string[]
  /**
   * What its reading blocks will name: each block the file binds to a
   * Library list, the list and the book on it now - "Read reads from Main:
   * A first book". Not a note: nothing is left out. Absent when the file
   * binds none.
   */
  reads?: string[]
}

/** What Apply will do to one routine of the file. */
export interface RoutineRow {
  /** Its title as the file writes it, or its place in the file when it has none. */
  title: string
  action: 'create' | 'update' | 'unchanged' | 'skip'
  notes: string[]
}

/** What Apply will do to one date of the roster. */
export interface RosterRow {
  date: string
  /** The kind it gets, when it gets one. */
  letter?: string
  kindName?: string
  action: 'set' | 'clear' | 'unchanged' | 'skip'
  note?: string
}

/** A text read against a plan: what it will do, and the plan it makes. */
export interface TemplatesImport {
  /** Set when the text is not read at all; nothing else is then. */
  error?: string
  /** Notes about the file itself - a field it does not have. */
  notes: string[]
  templates: TemplateRow[]
  routines: RoutineRow[]
  roster: RosterRow[]
  /** Dates around the roster's own, composed again because a kind beside them changed. */
  following: string[]
  /**
   * The dates already stamped with a template the file changes - lib/reimport.ts:
   * today and the dates ahead that follow it, how many dates behind today are
   * left as they were lived, and how many ticked blocks stay as they were.
   */
  refresh: { ahead: string[]; behind: number; kept: number }
  /** The plan Apply commits: the one given, itself, when nothing changes. */
  data: AppData
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const said = (x: unknown) => JSON.stringify(x)

/** A real date, as `YYYY-MM-DD`. */
function isDate(x: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const [y, m, d] = x.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/**
 * The list a block reads from, as the file says it: a list the Library has,
 * a name it waits for, or - null - none. Undefined where the file says
 * nothing, which leaves an updated block reading from what it did.
 */
type LibraryRead = { listId: string } | { waiting: string } | null

/** One block as the file gives it, read: its fields, and a note for each it leaves out. */
function readBlock(
  raw: unknown,
  n: number,
  data: AppData,
  notes: string[],
): { title: string; fields: Partial<TemplateBlock>; library?: LibraryRead } | undefined {
  if (!isObject(raw)) {
    notes.push(`Block ${n} is not an object - skipped.`)
    return undefined
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title) {
    notes.push(`Block ${n} has no title - skipped.`)
    return undefined
  }
  if (title.length > LIMITS.title) {
    notes.push(`Block ${n}'s title is longer than ${LIMITS.title} characters - skipped.`)
    return undefined
  }
  const note = (text: string) => notes.push(`${title}: ${text}`)
  const fields: Partial<TemplateBlock> = { title }
  const flag = (key: string): boolean | undefined => {
    const value = raw[key]
    if (value === undefined) return undefined
    if (typeof value !== 'boolean') {
      note(`${key} must be true or false - left out.`)
      return undefined
    }
    return value || undefined
  }

  if (raw.time !== undefined) {
    if (typeof raw.time === 'string' && TIME.test(raw.time)) fields.time = raw.time
    else note(`time ${said(raw.time)} is not HH:MM - left out.`)
  }
  if (raw.minutes !== undefined) {
    const m = raw.minutes
    if (typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= LIMITS.minutes) fields.minutes = m
    else note(`minutes ${said(m)} is not a whole number from 1 to ${LIMITS.minutes} - left out.`)
  }
  if (raw.category !== undefined) {
    const found = typeof raw.category === 'string' ? data.categories.find(c => c.id === raw.category || sameName(c.label, raw.category as string)) : undefined
    if (found) fields.category = found.id
    else note(`no category called ${said(raw.category)} - left out.`)
  }
  const core = flag('core')
  if (core) fields.core = true
  const key = flag('key')
  if (key) fields.highlight = true
  const ongoing = flag('ongoing')
  if (ongoing) fields.unbounded = true
  const afterMidnight = flag('afterMidnight')
  if (afterMidnight) {
    if (fields.time) fields.afterMidnight = true
    else note('afterMidnight needs a time - left out.')
  }
  let mealType: MealType | undefined
  if (raw.mealType !== undefined) {
    if (typeof raw.mealType === 'string' && (MEAL_TYPES as readonly string[]).includes(raw.mealType)) mealType = raw.mealType as MealType
    else note(`mealType ${said(raw.mealType)} is not one of ${MEAL_TYPES.join(', ')} - left out.`)
  }
  let follow = flag('followMeal')
  if (follow && !mealType) {
    note('followMeal needs a mealType - left out.')
    follow = undefined
  }
  const recipeIds: string[] = []
  const waiting: string[] = []
  if (raw.recipes !== undefined) {
    if (!Array.isArray(raw.recipes)) note('recipes must be a list of names - left out.')
    else {
      for (const name of raw.recipes) {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > LIMITS.title) {
          note(`recipe ${said(name)} is not a recipe's name - left out.`)
          continue
        }
        const recipe = data.recipes.find(r => sameName(r.title, name))
        if (recipe) {
          if (!recipeIds.includes(recipe.id)) recipeIds.push(recipe.id)
        } else {
          // Kept by name, and taken as soon as Kitchen has it - lib/waitingRecipes.ts.
          if (!waiting.some(w => sameName(w, name))) waiting.push(name.trim())
          note(`no recipe called ${said(name)} in Kitchen yet - the block waits for it, and takes it when a recipe of that name is added${mealType && recipeIds.length === 0 ? '; until then it keeps its meal type' : ''}.`)
        }
      }
    }
  }
  Object.assign(fields, mealFields({ ...(recipeIds.length ? { recipeIds } : {}), ...(mealType ? { mealType } : {}), ...(follow ? { follow: true } : {}) }))
  if (waiting.length > 0) fields.waitingRecipes = waiting
  // The list it reads from, by name - the same words, whatever their case or
  // spacing, the way a recipe is found. One the Library has not got yet waits
  // on the block, as a recipe does, and is read from as soon as a list of
  // that name is made (lib/waitingList.ts).
  let library: LibraryRead | undefined
  if (raw.library !== undefined) {
    const name = typeof raw.library === 'string' ? raw.library.trim() : ''
    if (raw.library === null) library = null
    else if (!name || name.length > LIMITS.name) note(`library ${said(raw.library)} is not a list's name - left out.`)
    else {
      const list = data.library.find(l => sameName(l.name, name))
      if (list) library = { listId: list.id }
      else {
        library = { waiting: name }
        note(`no list called ${said(raw.library)} in the Library yet - the block waits for it, and reads from it when a list of that name is made.`)
      }
    }
  }
  if (raw.note !== undefined) {
    if (typeof raw.note === 'string') {
      if (raw.note.trim()) fields.note = raw.note
    } else note('note must be text - left out.')
  }
  for (const k of Object.keys(raw)) if (!BLOCK_FIELDS.includes(k)) note(`${said(k)} is not a field of a block - left out.`)
  return { title, fields, ...(library !== undefined ? { library } : {}) }
}

/**
 * One routine as the file gives it, read against the kinds and the routine of
 * that title the app already has: its fields, and a note for each it leaves
 * out. Nothing when there is not enough of it to be a routine.
 *
 * The file writes a weekday 1 to 7 with Monday first, which is how a person
 * writes one; the app keeps 0 for Sunday, which is what `Date` gives.
 */
function readRoutine(
  raw: Record<string, unknown>,
  known: Routine | undefined,
  kinds: readonly Template[],
  data: AppData,
  notes: string[],
): RoutineInput | undefined {
  const title = (raw.title as string).trim()
  const note = (text: string) => notes.push(`${title}: ${text}`)
  const byLetter = (letter: string): Template | undefined => kinds.find(k => k.dayKind!.letter === cleanLetter(letter))

  let minutes = known?.minutes
  let kindMinutes = known?.kindMinutes
  if (raw.minutes !== undefined) {
    const one = raw.minutes
    const whole = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= ROUTINE_LIMITS.minutes
    if (whole(one)) {
      minutes = one as number
      kindMinutes = undefined
    } else if (isObject(one)) {
      const per: Record<string, number> = {}
      for (const [letter, value] of Object.entries(one)) {
        const kind = byLetter(letter)
        if (!kind) note(`no kind of day has the letter ${said(letter)} - its length is left out.`)
        else if (!whole(value)) note(`minutes for ${said(letter)} is not a whole number from 1 to ${ROUTINE_LIMITS.minutes} - left out.`)
        else per[kind.id] = value as number
      }
      const values = Object.values(per)
      if (values.length === 0) note('minutes says nothing this app can read - left out.')
      else {
        kindMinutes = per
        minutes = values[0]
      }
    } else note(`minutes ${said(one)} is not a whole number, nor a length for each kind - left out.`)
  }
  if (minutes === undefined) {
    note('it needs minutes - skipped.')
    return undefined
  }

  let category = known?.category
  if (raw.category !== undefined) {
    const found = typeof raw.category === 'string' ? data.categories.find(c => c.id === raw.category || sameName(c.label, raw.category as string)) : undefined
    if (found) category = found.id
    else note(`no category called ${said(raw.category)} - left out.`)
  }

  let core = known?.core
  if (raw.core !== undefined) {
    if (typeof raw.core === 'boolean') core = raw.core || undefined
    else note('core must be true or false - left out.')
  }

  let weekdays = known?.weekdays
  if (raw.weekdays !== undefined) {
    if (!Array.isArray(raw.weekdays)) note('weekdays must be a list of 1 to 7, Monday first - left out.')
    else {
      const days: number[] = []
      for (const day of raw.weekdays) {
        if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7) note(`weekday ${said(day)} is not 1 to 7, Monday first - left out.`)
        else days.push(day === 7 ? 0 : day)
      }
      if (days.length > 0) weekdays = days
    }
  }
  if (!weekdays || weekdays.length === 0) {
    note('it needs at least one weekday - skipped.')
    return undefined
  }

  let times = known?.times ?? {}
  if (raw.times !== undefined) {
    if (!isObject(raw.times)) note('times must be an object of a kind\'s letter and a time - left out.')
    else {
      const out: Record<string, string> = {}
      for (const [letter, time] of Object.entries(raw.times)) {
        const kind = byLetter(letter)
        if (!kind) note(`no kind of day has the letter ${said(letter)} - its time is left out.`)
        else if (typeof time !== 'string' || !TIME.test(time)) note(`time ${said(time)} for ${said(letter)} is not HH:MM - left out.`)
        else out[kind.id] = time
      }
      times = out
    }
  }

  for (const key of Object.keys(raw)) if (!ROUTINE_FIELDS.includes(key)) note(`${said(key)} is not a field of a routine - left out.`)

  return {
    title,
    ...(category ? { category } : {}),
    minutes,
    ...(kindMinutes && Object.keys(kindMinutes).length > 0 ? { kindMinutes } : {}),
    ...(core ? { core: true } : {}),
    weekdays,
    times,
  }
}

/** The fields this format writes on a block, all of them: a matched block's values give way to these. */
const FORMAT_BLOCK_KEYS = ['time', 'minutes', 'category', 'core', 'highlight', 'unbounded', 'afterMidnight', 'mealType', 'followMeal', 'recipeIds', 'recipeId', 'waitingRecipes', 'note'] as const

/**
 * Reads a text in the contract's format against a plan. Pure.
 *
 * @param now Minutes on today's clock, where the caller has a clock: today is
 * cut at it, so what has ended today stays as it was lived (lib/reimport.ts).
 * Without it today follows the file whole.
 */
export function readTemplatesJson(text: string, data: AppData, today: string, now?: number): TemplatesImport {
  const nothing: TemplatesImport = { notes: [], templates: [], routines: [], roster: [], following: [], refresh: { ahead: [], behind: 0, kept: 0 }, data }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { ...nothing, error: `This is not JSON: ${(e as Error).message}` }
  }
  if (!isObject(parsed)) return { ...nothing, error: 'This is not a JSON object.' }
  if (parsed.format !== undefined && parsed.format !== TEMPLATE_JSON_FORMAT) {
    return { ...nothing, error: `This is not a Dienius templates file: its format is ${said(parsed.format)}.` }
  }
  if (parsed.version !== undefined && parsed.version !== TEMPLATE_JSON_VERSION) {
    return { ...nothing, error: `This is version ${String(parsed.version)} of the format; this app reads version ${TEMPLATE_JSON_VERSION}.` }
  }

  const notes: string[] = []
  for (const key of Object.keys(parsed)) if (!FILE_FIELDS.includes(key)) notes.push(`${said(key)} is not a field of the file - left out.`)

  // The plan as the templates and the routines leave it - touched only where
  // something changes.
  let templates = data.templates
  let profiles = data.settings.sleepProfiles
  let routines = data.routines
  const plan = (): AppData =>
    templates === data.templates && profiles === data.settings.sleepProfiles && routines === data.routines
      ? data
      : { ...data, templates, routines, settings: { ...data.settings, sleepProfiles: profiles } }

  const rows: TemplateRow[] = []
  // The templates the file changes, as they were: what the dates already
  // stamped with them were stamped from.
  const changedTemplates = new Map<string, Template>()
  const entries: unknown[] = parsed.templates === undefined ? [] : Array.isArray(parsed.templates) ? parsed.templates : []
  if (parsed.templates !== undefined && !Array.isArray(parsed.templates)) notes.push('templates is not a list - left out.')
  // What each template is after a night names a kind by letter, and that
  // kind may come further down the file: read once every template is.
  const afterNights: { name: string; row: TemplateRow; letter: string | null }[] = []

  // A name given twice: the later one is read.
  const names = entries.map(e => (isObject(e) && typeof e.name === 'string' ? e.name.trim() : ''))
  let nextOrder = Math.max(-1, ...dayKinds(data.templates).map(t => t.dayKind!.order)) + 1

  entries.forEach((raw, i) => {
    const place = `Template ${i + 1}`
    if (!isObject(raw)) {
      rows.push({ name: place, action: 'skip', notes: ['It is not an object - skipped.'] })
      return
    }
    const name = names[i]
    if (!name) {
      rows.push({ name: place, action: 'skip', notes: ['It has no name - skipped.'] })
      return
    }
    const shown = raw.name as string
    if (name.length > LIMITS.name) {
      rows.push({ name: shown, action: 'skip', notes: [`Its name is longer than ${LIMITS.name} characters - skipped.`] })
      return
    }
    if (names.slice(i + 1).some(later => later && sameName(later, name))) {
      rows.push({ name: shown, action: 'skip', notes: ['The name comes again further down, and that one is read - skipped.'] })
      return
    }
    const week = templates.find(t => t.kind === 'week' && sameName(t.name, name))
    if (week) {
      rows.push({ name: shown, action: 'skip', notes: [`"${week.name}" is a week template - this file reads day templates only; skipped.`] })
      return
    }

    const own: string[] = []
    const known = templates.find(t => t.kind !== 'week' && sameName(t.name, name))

    let type: DayType | undefined = known?.type
    if (raw.type !== undefined) {
      if (typeof raw.type === 'string' && (DAY_TYPES as readonly string[]).includes(raw.type)) type = raw.type as DayType
      else own.push(`type ${said(raw.type)} is not full, shift, night or rest - left out.`)
    }

    let dayKind = known?.dayKind
    if (raw.kind !== undefined) {
      const letter = typeof raw.kind === 'string' ? cleanLetter(raw.kind) : ''
      if (!letter) own.push(`kind ${said(raw.kind)} is not a letter - left out.`)
      else {
        const holder = templates.find(t => t !== known && isDayKind(t) && t.dayKind!.letter === letter)
        if (holder) own.push(`kind "${letter}" is ${holder.name}'s already - left out.`)
        else dayKind = { letter, order: known?.dayKind ? known.dayKind.order : nextOrder++, ...(known?.dayKind?.afterNight ? { afterNight: known.dayKind.afterNight } : {}) }
      }
    }
    let afterNight: string | null | undefined
    if (raw.afterNight !== undefined) {
      if (raw.afterNight === null) afterNight = null
      else if (typeof raw.afterNight === 'string' && cleanLetter(raw.afterNight)) afterNight = cleanLetter(raw.afterNight)
      else own.push(`afterNight ${said(raw.afterNight)} is not a letter - left out.`)
      if (afterNight !== undefined && !dayKind) {
        own.push('afterNight needs a kind - left out.')
        afterNight = undefined
      }
    }

    let color = known?.color ?? PALETTE_COLORS[templates.filter(t => t.kind !== 'week').length % PALETTE_COLORS.length].value
    if (raw.color !== undefined) {
      if (typeof raw.color === 'string' && COLOR.test(raw.color)) color = raw.color.toLowerCase()
      else own.push(`color ${said(raw.color)} is not a #rrggbb colour - left out.`)
    }

    let sleepProfileId = known?.sleepProfileId
    if (raw.sleep !== undefined) {
      const s = raw.sleep
      const from = isObject(s) && typeof s.from === 'string' && TIME.test(s.from) ? s.from : undefined
      const to = isObject(s) && typeof s.to === 'string' && TIME.test(s.to) ? s.to : undefined
      if (!from || !to || from === to) own.push('sleep needs two different times, from and to - left out.')
      else {
        let profile: SleepProfile | undefined = profiles.find(p => p.window.start === from && p.window.end === to)
        if (!profile) {
          profile = { id: crypto.randomUUID(), name: `${from}-${to}`, window: { start: from, end: to } }
          profiles = [...profiles, profile]
        }
        sleepProfileId = profile.id
      }
    }

    for (const key of Object.keys(raw)) if (!TEMPLATE_FIELDS.includes(key)) own.push(`${said(key)} is not a field of a template - left out.`)

    let blocks = known?.blocks ?? []
    const reads: string[] = []
    if (raw.blocks !== undefined) {
      if (!Array.isArray(raw.blocks)) own.push('blocks is not a list - left out.')
      else {
        const planned = { ...plan(), templates }
        const taken = new Set<string>()
        blocks = raw.blocks.flatMap((b, n) => {
          const read = readBlock(b, n + 1, planned, own)
          if (!read) return []
          if (read.library && 'listId' in read.library) {
            const list = planned.library.find(l => l.id === (read.library as { listId: string }).listId)!
            const book = currentItem(list)
            reads.push(`${read.title} reads from ${list.name}: ${book ? book.title : 'everything in it is finished'}`)
          }
          const match = known?.blocks.find(old => !taken.has(old.id) && sameName(old.title, read.title))
          if (match) {
            taken.add(match.id)
            const kept = { ...match } as Record<string, unknown>
            for (const k of FORMAT_BLOCK_KEYS) delete kept[k]
            return [readingFrom({ ...(kept as unknown as TemplateBlock), ...withoutUndefined(read.fields), title: read.title }, read.library)]
          }
          return [readingFrom({ id: crypto.randomUUID(), ...withoutUndefined(read.fields), title: read.title } as TemplateBlock, read.library)]
        })
      }
    }
    const withReads = reads.length > 0 ? { reads } : {}

    const next: Template = {
      ...(known ?? { id: crypto.randomUUID(), name }),
      name: known?.name ?? name,
      color,
      blocks,
      ...(type !== undefined ? { type } : {}),
      ...(sleepProfileId !== undefined ? { sleepProfileId } : {}),
      ...(dayKind ? { dayKind } : {}),
    } as Template
    if (!type) delete (next as Partial<Template>).type
    if (!sleepProfileId) delete (next as Partial<Template>).sleepProfileId
    if (!dayKind) delete (next as Partial<Template>).dayKind

    if (known) {
      const now = plan()
      const same =
        JSON.stringify(templateEntry(next, now)) === JSON.stringify(templateEntry(known, now)) &&
        (known.dayKind?.order ?? -1) === (next.dayKind?.order ?? -1) &&
        JSON.stringify(known.blocks.map(b => b.id)) === JSON.stringify(next.blocks.map(b => b.id))
      if (same) {
        rows.push({ name: shown, action: 'unchanged', notes: own, ...withReads })
      } else {
        templates = templates.map(t => (t.id === known.id ? next : t))
        changedTemplates.set(known.id, known)
        rows.push({ name: shown, action: 'update', notes: own, ...withReads })
      }
    } else {
      templates = [...templates, next]
      rows.push({ name: shown, action: 'create', notes: own, ...withReads })
    }
    if (afterNight !== undefined) afterNights.push({ name, row: rows[rows.length - 1], letter: afterNight })
  })

  // The kind each template is after a night - section 2.6 - now that every
  // kind in the file is there to be named. A change here is a change to the
  // template, so a row read as unchanged above says update.
  for (const { name, row, letter } of afterNights) {
    const template = templates.find(t => t.kind !== 'week' && sameName(t.name, name))
    if (!template?.dayKind) continue
    let after: string | undefined
    if (letter !== null) {
      const kinds = dayKinds(templates)
      const found = kinds.find(k => k.dayKind!.letter === letter)
      if (!found) {
        row.notes.push(`afterNight "${letter}" names no kind of day - left out.`)
        continue
      }
      if (found.id === template.id) {
        row.notes.push(`afterNight "${letter}" is this template itself - left out.`)
        continue
      }
      after = found.id
    }
    if ((template.dayKind.afterNight ?? '') === (after ?? '')) continue
    const { afterNight: _was, ...mark } = template.dayKind
    const next: Template = { ...template, dayKind: { ...mark, ...(after ? { afterNight: after } : {}) } }
    templates = templates.map(t => (t.id === template.id ? next : t))
    if (row.action === 'unchanged') row.action = 'update'
  }

  // The routines, against the kinds the templates leave: a time and a length
  // are written by a kind's letter, so the kinds have to be read first.
  const routineRows: RoutineRow[] = []
  const rawRoutines: unknown[] = parsed.routines === undefined ? [] : Array.isArray(parsed.routines) ? parsed.routines : []
  if (parsed.routines !== undefined && !Array.isArray(parsed.routines)) notes.push('routines is not a list - left out.')
  if (rawRoutines.length > 0) {
    const kinds = dayKinds(templates)
    const titles = rawRoutines.map(e => (isObject(e) && typeof e.title === 'string' ? e.title.trim() : ''))
    rawRoutines.forEach((raw, i) => {
      const place = `Routine ${i + 1}`
      if (!isObject(raw)) {
        routineRows.push({ title: place, action: 'skip', notes: ['It is not an object - skipped.'] })
        return
      }
      const title = titles[i]
      if (!title) {
        routineRows.push({ title: place, action: 'skip', notes: ['It has no title - skipped.'] })
        return
      }
      const shown = raw.title as string
      if (title.length > ROUTINE_LIMITS.title) {
        routineRows.push({ title: shown, action: 'skip', notes: [`Its title is longer than ${ROUTINE_LIMITS.title} characters - skipped.`] })
        return
      }
      if (titles.slice(i + 1).some(later => later && sameName(later, title))) {
        routineRows.push({ title: shown, action: 'skip', notes: ['The title comes again further down, and that one is read - skipped.'] })
        return
      }
      const own: string[] = []
      const known = routines.find(r => sameName(r.title, title))
      const read = readRoutine(raw, known, kinds, plan(), own)
      if (!read) {
        routineRows.push({ title: shown, action: 'skip', notes: own })
        return
      }
      const clean = cleanRoutine(read, kinds.map(k => k.id))
      if (!clean) {
        routineRows.push({ title: shown, action: 'skip', notes: [...own, 'There is no routine in it - skipped.'] })
        return
      }
      const next: Routine = { ...(known ?? { id: crypto.randomUUID() }), ...clean, title: known?.title ?? clean.title }
      if (known) {
        const same = JSON.stringify(routineEntry(next, kinds, plan())) === JSON.stringify(routineEntry(known, kinds, plan()))
        if (same) {
          routineRows.push({ title: shown, action: 'unchanged', notes: own })
          return
        }
        routines = routines.map(r => (r.id === known.id ? next : r))
        routineRows.push({ title: shown, action: 'update', notes: own })
      } else {
        routines = [...routines, next]
        routineRows.push({ title: shown, action: 'create', notes: own })
      }
    })
  }

  // The roster, against the plan the templates and the routines leave.
  const afterTemplates = plan()
  const roster: RosterRow[] = []
  const draft: Record<string, string | null> = {}
  if (parsed.roster !== undefined) {
    if (!isObject(parsed.roster)) notes.push('roster is not an object of dates - left out.')
    else {
      const kinds = dayKinds(afterTemplates.templates)
      for (const date of Object.keys(parsed.roster).sort()) {
        const value = parsed.roster[date]
        if (!isDate(date)) {
          roster.push({ date, action: 'skip', note: `${said(date)} is not a date.` })
          continue
        }
        if (date < today) {
          roster.push({ date, action: 'skip', note: 'Before today - a lived day keeps what it was.' })
          continue
        }
        if (value === null) {
          draft[date] = null
          roster.push({ date, action: 'clear' })
          continue
        }
        if (typeof value !== 'string' || !value.trim()) {
          roster.push({ date, action: 'skip', note: `${said(value)} must be a letter, a name or null.` })
          continue
        }
        const byLetter = kinds.find(k => k.dayKind!.letter === cleanLetter(value))
        const byName = afterTemplates.templates.find(t => t.kind !== 'week' && sameName(t.name, value))
        const kind = byLetter ?? (byName && isDayKind(byName) ? byName : undefined)
        if (!kind) {
          roster.push({
            date,
            action: 'skip',
            note: byName ? `${said(byName.name)} is not a kind of day - give it a letter.` : `No kind of day has the letter or name ${said(value)}.`,
          })
          continue
        }
        draft[date] = kind.id
        roster.push({ date, letter: kind.dayKind!.letter, kindName: kind.name, action: 'set' })
      }
    }
  }

  const applied = Object.keys(draft).length > 0 ? rosterApplied(afterTemplates, draft, today) : { plan: afterTemplates, composed: [], following: [] }
  const changed = new Set(applied.composed.map(c => c.date))
  for (const row of roster) {
    if ((row.action === 'set' || row.action === 'clear') && !changed.has(row.date)) row.action = 'unchanged'
  }
  // A date read as another kind than the one written for it - a rest day
  // after a night, or one whose night went - says so on its row, and a date
  // the file did not name but a night before it turned gets a row of its own.
  for (const { date, kind, resolved } of applied.composed) {
    if (!resolved || !kind) continue
    const note = resolved.why === 'after-night' ? `${resolved.from.name} after a night is ${kind.name}.` : `No night before it now, so ${kind.name} again.`
    const row = roster.find(r => r.date === date)
    if (row) Object.assign(row, { letter: kind.dayKind!.letter, kindName: kind.name, action: 'set', note })
    else roster.push({ date, letter: kind.dayKind!.letter, kindName: kind.name, action: 'set', note })
  }
  roster.sort((a, b) => a.date.localeCompare(b.date))

  // Today, when the roster changed its kind, keeps what it has lived; then
  // today and the dates ahead stamped with a template the file changed
  // follow it, and the dates behind are left as they were - lib/reimport.ts.
  let laid = applied.plan
  const livedToday = laid.days[today] ? keepTodayAsLived(data.days[today], laid.days[today], now) : undefined
  if (livedToday && livedToday !== laid.days[today]) laid = { ...laid, days: { ...laid.days, [today]: livedToday } }
  const refreshed = refreshStampedDays(laid, changedTemplates, today, now)
  return {
    notes,
    templates: rows,
    routines: routineRows,
    roster,
    following: applied.following.map(f => f.date),
    refresh: { ahead: refreshed.ahead, behind: refreshed.behind, kept: refreshed.kept },
    data: refreshed.data,
  }
}

/**
 * A block reading from the list the file names, waiting for it, or - null -
 * reading from none. Undefined leaves the block as it is: a file that says
 * nothing about a list does not take one away from a block that has it.
 */
function readingFrom(block: TemplateBlock, library: LibraryRead | undefined): TemplateBlock {
  if (library === undefined) return block
  const { libraryListId: _list, waitingLibrary: _waiting, ...rest } = block
  if (library === null) return rest
  return 'listId' in library ? { ...rest, libraryListId: library.listId } : { ...rest, waitingLibrary: library.waiting }
}

/** An object with its undefined values left out, so a block holds only what it says. */
function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
