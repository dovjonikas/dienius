import { commit, getData } from './core'
import type { DayType, MealType, Template, TemplateKind, WeekDayOverride } from '../types'
import type { CategoryId } from '../categories'
import { applyStamps } from '../stamping'
import { applyRoster, composeDay, followNeighbours } from '../shiftDay'
import { isDayKind, kindOnDate } from '../dayKinds'
import { todayKey } from '../dates'
import { readTemplatesJson, type TemplatesImport } from '../templateJson'

/** Templates: making them, stamping them onto dates, and the weekday map. */
export const templateActions = {
  addTemplate(input: {
    name: string
    color: string
    type?: DayType
    sleepProfileId?: string
    /** Absent means a day template - see `TemplateKind`. */
    kind?: TemplateKind
    weekDays?: Partial<Record<number, WeekDayOverride>>
    // Every field a TemplateBlock has, not a subset. This list used to stop
    // at unbounded, which silently dropped the category off every block of
    // every newly created template - the editor was passing it and this was
    // throwing it away, so a template arrived colourless and only picked its
    // colours up if somebody edited and saved it again (updateTemplate takes
    // a whole Template and never had the gap). Found by writing the library
    // binding's own test, which lost its binding the same way.
    blocks: {
      time?: string
      title: string
      core?: boolean
      minutes?: number
      unbounded?: boolean
      category?: CategoryId
      libraryListId?: string
      recipeId?: string
      recipeIds?: string[]
      mealType?: MealType
      weekday?: number
      groupId?: string
      note?: string
      noteExpanded?: boolean
      highlight?: boolean
      afterMidnight?: boolean
    }[]
  }): Template {
    const data = getData()
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      type: input.type,
      sleepProfileId: input.sleepProfileId,
      kind: input.kind,
      weekDays: input.weekDays,
      blocks: input.blocks.map(b => ({
        id: crypto.randomUUID(),
        time: b.time,
        title: b.title,
        core: b.core,
        minutes: b.minutes,
        unbounded: b.unbounded,
        category: b.category,
        libraryListId: b.libraryListId,
        recipeId: b.recipeId,
        recipeIds: b.recipeIds,
        mealType: b.mealType,
        weekday: b.weekday,
        groupId: b.groupId,
        note: b.note,
        noteExpanded: b.noteExpanded,
        highlight: b.highlight,
        afterMidnight: b.afterMidnight,
      })),
    }
    commit({ ...data, templates: [...data.templates, template] })
    return template
  },

  /**
   * Templates and a roster from JSON - v2.33, lib/templateJson.ts and
   * docs/TEMPLATE-JSON.md. Read against the plan as it is now, and written in
   * one commit - the templates, any sleep schedule they name, and the roster
   * through the Roster's own path - so one undo puts it all back. A text that
   * cannot be read, or that changes nothing, writes nothing.
   */
  importTemplatesJson(text: string): { read: TemplatesImport; undo: () => void } {
    const previous = getData()
    const read = readTemplatesJson(text, previous, todayKey())
    if (!read.error && read.data !== previous) commit(read.data)
    return { read, undo: () => commit(previous) }
  },

  updateTemplate(template: Template): void {
    const data = getData()
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === template.id ? template : t)),
    })
  },

  /**
   * The template goes, and so does every weekday the map gave it - a map
   * naming a template that is gone stamps nothing. The days it was stamped
   * on keep it (DECISIONS "A stamped day outlives its template").
   */
  deleteTemplate(id: string): void {
    const data = getData()
    const weekdayTemplates = Object.fromEntries(Object.entries(data.settings.weekdayTemplates).filter(([, mapped]) => mapped !== id))
    commit({
      ...data,
      templates: data.templates.filter(t => t.id !== id),
      settings: { ...data.settings, weekdayTemplates },
    })
  },

  /**
   * A template onto dates - the month's brush, the rail's chip, a week at a
   * time. A kind of day is composed rather than stamped (rotating shifts,
   * docs/RESEARCH-SHIFTS.md section 6.2): its blocks land the way any
   * template's do and its routines land with them, so a kind means the same
   * day whichever door it came through. Taking a kind off takes its routines
   * with it. A hand reaches a day that is over, unlike the roster, because
   * somebody is looking at that date while they press it.
   */
  stamp(stamps: Record<string, string | null>): void {
    const data = getData()
    const kindOf = (id: string | null | undefined) => {
      const template = id ? data.templates.find(t => t.id === id) : undefined
      return template && isDayKind(template) ? template : undefined
    }
    const kinds: Record<string, string | null> = {}
    const plain: Record<string, string | null> = {}
    for (const [date, id] of Object.entries(stamps)) {
      const arriving = kindOf(id)
      const leaving = kindOf(data.days[date]?.templateId)
      if (arriving || (!id && leaving)) kinds[date] = id
      else plain[date] = id
    }
    const stamped =
      Object.keys(plain).length > 0 ? { ...data, days: applyStamps(data.days, data.templates, plain, data.library, data.recipes) } : data
    const composed = Object.keys(kinds).length > 0 ? applyRoster(stamped, kinds, todayKey(), { reach: 'any' }) : stamped
    // A kind an ordinary template stamped over is a kind that changed: the
    // date is no kind now, so its routines leave it - a task still as its
    // rule left it goes, one ticked or moved stays, the way a roster taking
    // a kind off leaves a date - and the dates around it follow it the way
    // they follow the roster (section 10.2a of RESEARCH-SHIFTS). Without the
    // first, the gym stayed on a date the kind had left, at the kind's time.
    const today = todayKey()
    const leftKind = Object.keys(plain).filter(date => kindOf(data.days[date]?.templateId))
    let next = composed
    for (const date of leftKind) {
      const reading = next
      const { day } = composeDay(reading, date, undefined, on => kindOnDate(reading, on), today)
      if (day !== next.days[date]) next = { ...next, days: { ...next.days, [date]: day } }
    }
    if (leftKind.length > 0) next = followNeighbours(next, leftKind, today, new Set(Object.keys(kinds)))
    if (next !== data) commit(next)
  },

  /**
   * Which template a weekday starts from.
   *
   * A week template fills all seven at once, and clearing one of its days
   * clears all seven. That is not a shortcut, it is what the thing *is*: a
   * week template's Monday is not a template somebody could sensibly put on
   * Wednesday, so a map holding it on one weekday and something else on
   * another would be a map describing a week that does not exist. One press
   * to set the week, one press to take it back.
   */
  setWeekdayTemplate(weekday: number, templateId: string | undefined): void {
    const data = getData()
    const next = { ...data.settings.weekdayTemplates }
    const chosen = templateId ? data.templates.find(t => t.id === templateId) : undefined
    const clearing = data.templates.find(t => t.id === next[weekday])

    if (chosen?.kind === 'week') {
      for (let d = 0; d < 7; d++) next[d] = chosen.id
    } else if (templateId) {
      next[weekday] = templateId
    } else if (clearing?.kind === 'week') {
      for (let d = 0; d < 7; d++) if (next[d] === clearing.id) delete next[d]
    } else {
      delete next[weekday]
    }

    commit({ ...data, settings: { ...data.settings, weekdayTemplates: next } })
  },
}
