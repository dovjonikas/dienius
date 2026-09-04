import { commit, getData } from './core'
import type { DayType, Template } from '../types'
import type { CategoryId } from '../categories'
import { applyStamps } from '../stamping'

/** Templates: making them, stamping them onto dates, and the weekday map. */
export const templateActions = {
  addTemplate(input: {
    name: string
    color: string
    type?: DayType
    sleepProfileId?: string
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
    }[]
  }): Template {
    const data = getData()
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      type: input.type,
      sleepProfileId: input.sleepProfileId,
      blocks: input.blocks.map(b => ({
        id: crypto.randomUUID(),
        time: b.time,
        title: b.title,
        core: b.core,
        minutes: b.minutes,
        unbounded: b.unbounded,
        category: b.category,
        libraryListId: b.libraryListId,
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

  setWeekdayTemplate(weekday: number, templateId: string | undefined): void {
    const data = getData()
    const next = { ...data.settings.weekdayTemplates }
    if (templateId) next[weekday] = templateId
    else delete next[weekday]
    commit({ ...data, settings: { ...data.settings, weekdayTemplates: next } })
  },
}
