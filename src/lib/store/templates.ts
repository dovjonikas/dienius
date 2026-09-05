import { commit, getData } from './core'
import type { DayType, Template, TemplateKind, WeekDayOverride } from '../types'
import type { CategoryId } from '../categories'
import { applyStamps } from '../stamping'

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
      weekday?: number
      groupId?: string
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
        weekday: b.weekday,
        groupId: b.groupId,
      })),
    }
    commit({ ...data, templates: [...data.templates, template] })
    return template
  },

  updateTemplate(template: Template): void {
    const data = getData()
    commit({
      ...data,
      templates: data.templates.map(t => (t.id === template.id ? template : t)),
    })
  },

  deleteTemplate(id: string): void {
    const data = getData()
    commit({ ...data, templates: data.templates.filter(t => t.id !== id) })
  },

  stamp(stamps: Record<string, string | null>): void {
    const data = getData()
    commit({ ...data, days: applyStamps(data.days, data.templates, stamps, data.library) })
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
