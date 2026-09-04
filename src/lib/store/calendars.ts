import { commit, getData } from './core'
import type { CalendarSubscription } from '../types'

/** External calendar subscriptions. What they contain lives under their own key - see lib/calendars.ts. */
export const calendarActions = {
  /**
   * Calendars somebody else owns - see `CalendarSubscription`.
   *
   * Only the subscription is stored here. What it contains lives under its own
   * local key and is refetched per device, because a week of work meetings is
   * not a plan worth carrying in a backup and is stale the moment it is
   * written.
   */
  addCalendar(input: { name: string; url?: string; color: string }): CalendarSubscription | undefined {
    const data = getData()
    const name = input.name.trim()
    if (!name) return undefined
    const calendar: CalendarSubscription = {
      id: crypto.randomUUID(),
      name,
      url: input.url?.trim() || undefined,
      color: input.color,
      enabled: true,
    }
    commit({ ...data, settings: { ...data.settings, calendars: [...(data.settings.calendars ?? []), calendar] } })
    return calendar
  },

  updateCalendar(id: string, patch: Partial<Omit<CalendarSubscription, 'id'>>): void {
    const data = getData()
    const calendars = (data.settings.calendars ?? []).map(c => (c.id === id ? { ...c, ...patch } : c))
    commit({ ...data, settings: { ...data.settings, calendars } })
  },

  deleteCalendar(id: string): void {
    const data = getData()
    const calendars = (data.settings.calendars ?? []).filter(c => c.id !== id)
    commit({ ...data, settings: { ...data.settings, calendars } })
  },
}
