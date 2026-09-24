import { weekdayOf } from './repeats'
import type { AppData } from './types'

/**
 * The template the weekday map gives a date, or nothing - and nothing, too,
 * when the map names a template that is gone.
 *
 * Deleting a template takes it off the map (store/templates.ts), but a plan
 * saved before that was so, or a map synced from an older device, can still
 * name one. A reader that took the name on trust stamped nothing and said it
 * had, and left today's tasks behind for a tomorrow that was never going to
 * get them.
 */
export function mappedTemplateId(data: Pick<AppData, 'settings' | 'templates'>, date: string): string | undefined {
  const id = data.settings.weekdayTemplates[weekdayOf(date)]
  return id !== undefined && data.templates.some(t => t.id === id) ? id : undefined
}
