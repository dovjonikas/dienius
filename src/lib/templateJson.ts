import { MEAL_TYPES, type AppData, type DayType, type MealType, type SleepProfile, type Template, type TemplateBlock } from './types'
import { PALETTE_COLORS } from './colors'
import { cleanLetter, dayKinds, isDayKind, kindOnDate } from './dayKinds'
import { rosterApplied } from './shiftDay'
import { sameName } from './recipeImport'
import { mealFields } from './kitchen'

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

const FILE_FIELDS = ['format', 'version', 'templates', 'roster']
const TEMPLATE_FIELDS = ['name', 'type', 'kind', 'color', 'sleep', 'blocks']
const BLOCK_FIELDS = ['time', 'title', 'minutes', 'category', 'core', 'key', 'ongoing', 'afterMidnight', 'mealType', 'followMeal', 'recipes', 'note']

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
  const recipes = ids.flatMap(id => data.recipes.filter(r => r.id === id).map(r => r.title))
  if (recipes.length === 0 && block.mealType) {
    out.mealType = block.mealType
    if (block.followMeal) out.followMeal = true
  }
  if (recipes.length > 0) out.recipes = recipes
  if (block.note) out.note = block.note
  return out
}

/** A template as the file writes it. No `type` for a full day, no `sleep` for the first schedule. */
function templateEntry(template: Template, data: AppData): Entry {
  const out: Entry = { name: template.name }
  if (template.type && template.type !== 'full') out.type = template.type
  if (isDayKind(template)) out.kind = template.dayKind!.letter
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

/** An object on one line, the way the file writes a block and a sleep. */
function inline(entry: Entry): string {
  return `{ ${Object.entries(entry).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`
}

/** The day templates in the order the file writes them: the kinds in the roster's order, then the rest by name. */
function inFileOrder(templates: readonly Template[]): Template[] {
  const others = templates.filter(t => t.kind !== 'week' && !isDayKind(t)).sort((a, b) => a.name.localeCompare(b.name))
  return [...dayKinds([...templates]), ...others]
}

/** The plan's templates and its roster from today on, in the contract's format. */
export function templatesJson(data: AppData, today: string): string {
  const templates = inFileOrder(data.templates).map(t => templateEntry(t, data))
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
  roster: RosterRow[]
  /** Dates around the roster's own, composed again because a kind beside them changed. */
  following: string[]
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

/** One block as the file gives it, read: its fields, and a note for each it leaves out. */
function readBlock(
  raw: unknown,
  n: number,
  data: AppData,
  notes: string[],
): { title: string; fields: Partial<TemplateBlock> } | undefined {
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
  if (raw.recipes !== undefined) {
    if (!Array.isArray(raw.recipes)) note('recipes must be a list of names - left out.')
    else {
      for (const name of raw.recipes) {
        const recipe = typeof name === 'string' ? data.recipes.find(r => sameName(r.title, name)) : undefined
        if (recipe) {
          if (!recipeIds.includes(recipe.id)) recipeIds.push(recipe.id)
        } else note(`no recipe called ${said(name)} in Kitchen - ${mealType ? 'the block keeps its meal type' : 'left out'}.`)
      }
    }
  }
  Object.assign(fields, mealFields({ ...(recipeIds.length ? { recipeIds } : {}), ...(mealType ? { mealType } : {}), ...(follow ? { follow: true } : {}) }))
  if (raw.note !== undefined) {
    if (typeof raw.note === 'string') {
      if (raw.note.trim()) fields.note = raw.note
    } else note('note must be text - left out.')
  }
  for (const k of Object.keys(raw)) if (!BLOCK_FIELDS.includes(k)) note(`${said(k)} is not a field of a block - left out.`)
  return { title, fields }
}

/** The fields this format writes on a block, all of them: a matched block's values give way to these. */
const FORMAT_BLOCK_KEYS = ['time', 'minutes', 'category', 'core', 'highlight', 'unbounded', 'afterMidnight', 'mealType', 'followMeal', 'recipeIds', 'recipeId', 'note'] as const

/** Reads a text in the contract's format against a plan. Pure. */
export function readTemplatesJson(text: string, data: AppData, today: string): TemplatesImport {
  const nothing: TemplatesImport = { notes: [], templates: [], roster: [], following: [], data }
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

  // The plan as the templates leave it - touched only where something changes.
  let templates = data.templates
  let profiles = data.settings.sleepProfiles
  const plan = (): AppData =>
    templates === data.templates && profiles === data.settings.sleepProfiles
      ? data
      : { ...data, templates, settings: { ...data.settings, sleepProfiles: profiles } }

  const rows: TemplateRow[] = []
  const entries: unknown[] = parsed.templates === undefined ? [] : Array.isArray(parsed.templates) ? parsed.templates : []
  if (parsed.templates !== undefined && !Array.isArray(parsed.templates)) notes.push('templates is not a list - left out.')

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
        else dayKind = { letter, order: known?.dayKind ? known.dayKind.order : nextOrder++ }
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
    if (raw.blocks !== undefined) {
      if (!Array.isArray(raw.blocks)) own.push('blocks is not a list - left out.')
      else {
        const planned = { ...plan(), templates }
        const taken = new Set<string>()
        blocks = raw.blocks.flatMap((b, n) => {
          const read = readBlock(b, n + 1, planned, own)
          if (!read) return []
          const match = known?.blocks.find(old => !taken.has(old.id) && sameName(old.title, read.title))
          if (match) {
            taken.add(match.id)
            const kept = { ...match } as Record<string, unknown>
            for (const k of FORMAT_BLOCK_KEYS) delete kept[k]
            return [{ ...(kept as unknown as TemplateBlock), ...withoutUndefined(read.fields), title: read.title }]
          }
          return [{ id: crypto.randomUUID(), ...withoutUndefined(read.fields), title: read.title } as TemplateBlock]
        })
      }
    }

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
        rows.push({ name: shown, action: 'unchanged', notes: own })
        return
      }
      templates = templates.map(t => (t.id === known.id ? next : t))
      rows.push({ name: shown, action: 'update', notes: own })
    } else {
      templates = [...templates, next]
      rows.push({ name: shown, action: 'create', notes: own })
    }
  })

  // The roster, against the plan the templates leave.
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
  return {
    notes,
    templates: rows,
    roster,
    following: applied.following.map(f => f.date),
    data: applied.plan,
  }
}

/** An object with its undefined values left out, so a block holds only what it says. */
function withoutUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
