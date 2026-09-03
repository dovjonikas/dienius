import { useSyncExternalStore } from 'react'
import type { CalendarSubscription } from './types'
import { todayKey } from './dates'
import { ICS_HORIZON_DAYS, parseIcs, type IcsEvent } from './ics'
import { getSyncConfig } from './syncClient'

/**
 * External calendars, cached on the device that fetched them.
 *
 * The subscriptions themselves live in settings and sync; what they contain
 * lives here and does not. A week of somebody's work meetings is not a plan
 * worth carrying in a backup and is stale the moment it is written, so each
 * device fetches its own copy and keeps it under this key - the same reasoning
 * that keeps the timer and the daily snapshots out of `AppData`.
 *
 * Nothing in this module can fail loudly. A feed that has moved, an expired
 * secret address, a laptop with no connection: every one of those has to leave
 * the plan exactly as it was and put a sentence in Settings.
 */

const CACHE_KEY = 'dienius:calendars'

/** How often a feed is refetched while the app is open. */
export const REFRESH_INTERVAL_MS = 30 * 60 * 1000

export interface CalendarCacheEntry {
  events: IcsEvent[]
  /** ISO instant of the last successful fetch. */
  fetchedAt?: string
  /** A sentence for Settings when the last attempt failed. */
  error?: string
  /** What the parser could not read - see parseIcs. */
  ignored?: string[]
}

export type CalendarCache = Record<string, CalendarCacheEntry>

let cache: CalendarCache = load()
const listeners = new Set<() => void>()

function load(): CalendarCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return isCache(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isCache(x: unknown): x is CalendarCache {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  return Object.values(x as Record<string, unknown>).every(
    entry => typeof entry === 'object' && entry !== null && Array.isArray((entry as CalendarCacheEntry).events),
  )
}

function save() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // A device that cannot cache simply refetches. Not worth a message.
  }
  listeners.forEach(fn => fn())
}

export function getCalendarCache(): CalendarCache {
  return cache
}

export function subscribeCalendars(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useCalendarCache(): CalendarCache {
  return useSyncExternalStore(subscribeCalendars, getCalendarCache, getCalendarCache)
}

/** Test seam, and what "erase all data" reaches for. */
export function clearCalendarCache(): void {
  cache = {}
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Nothing to do about it and nothing that depends on it.
  }
  listeners.forEach(fn => fn())
}

export function putCalendarEntry(id: string, entry: CalendarCacheEntry): void {
  cache = { ...cache, [id]: entry }
  save()
}

export function dropCalendarEntry(id: string): void {
  const { [id]: _gone, ...rest } = cache
  cache = rest
  save()
}

/**
 * Every event on one day, from every enabled calendar, in the order they
 * start.
 *
 * All-day events sort first, because "you are at a conference today" is the
 * frame the rest of the day sits inside rather than something that happens at
 * a time within it.
 */
export interface DayEvent extends IcsEvent {
  calendarId: string
  calendarName: string
  color: string
}

export function eventsOn(
  date: string,
  subscriptions: CalendarSubscription[] | undefined,
  cacheNow: CalendarCache = cache,
): DayEvent[] {
  const out: DayEvent[] = []
  for (const sub of subscriptions ?? []) {
    if (!sub.enabled) continue
    for (const event of cacheNow[sub.id]?.events ?? []) {
      if (event.date !== date) continue
      out.push({ ...event, calendarId: sub.id, calendarName: sub.name, color: sub.color })
    }
  }
  return out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return (a.startMinutes ?? 0) - (b.startMinutes ?? 0)
  })
}

/**
 * The intervals an external calendar has already spoken for on one day.
 *
 * This is what makes the free-time figure honest. A morning with three
 * meetings in it is not five hours of free time with three things written on
 * top; it is two hours, and a planner that says otherwise is one you stop
 * believing. All-day events are deliberately not counted - "at a conference"
 * does not mean every minute is booked, and treating it that way would report
 * zero free time on a day somebody could still plan an evening in.
 */
export function busyIntervals(
  date: string,
  subscriptions: CalendarSubscription[] | undefined,
  cacheNow: CalendarCache = cache,
): { start: number; end: number }[] {
  return eventsOn(date, subscriptions, cacheNow)
    .filter(e => !e.allDay && e.startMinutes !== undefined)
    .map(e => ({ start: e.startMinutes!, end: e.startMinutes! + (e.minutes ?? 30) }))
}

// --- fetching -------------------------------------------------------------

export interface FetchOutcome {
  ok: boolean
  message?: string
}

/**
 * Why a subscription cannot be refreshed on this device, if it cannot.
 *
 * A browser cannot fetch a Google or Outlook iCal address itself - those hosts
 * send no CORS headers and the response is refused before the page sees it -
 * so a subscription needs the sync server standing in front of it. Said in
 * Settings up front rather than discovered as a failure: without sync, file
 * import is the way in, and that is a sentence, not an error.
 */
export function subscriptionBlocker(): string | null {
  const config = getSyncConfig()
  if (!config.enabled || !config.url) {
    return 'Subscriptions need the sync server, which fetches the feed for you - a browser is not allowed to. Import a .ics file instead, or turn sync on above.'
  }
  return null
}

/** Fetches one subscription through the sync server and caches what it holds. */
export async function refreshCalendar(sub: CalendarSubscription, from = todayKey()): Promise<FetchOutcome> {
  if (!sub.url) return { ok: false, message: 'This calendar came from a file, so there is nothing to refresh.' }
  const blocked = subscriptionBlocker()
  if (blocked) {
    putCalendarEntry(sub.id, { ...(cache[sub.id] ?? { events: [] }), error: blocked })
    return { ok: false, message: blocked }
  }

  const config = getSyncConfig()
  try {
    const response = await fetch(`${config.url}/ics?url=${encodeURIComponent(sub.url)}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    })
    const body = (await response.json()) as { text?: string; error?: string }
    if (!response.ok || typeof body.text !== 'string') {
      const message = body.error ?? `The server answered ${response.status}.`
      // The events already held are kept. A feed that is briefly unreachable
      // should not blank the day it was describing a minute ago.
      putCalendarEntry(sub.id, { ...(cache[sub.id] ?? { events: [] }), error: message })
      return { ok: false, message }
    }
    return absorb(sub.id, body.text, from)
  } catch {
    const message = 'Could not reach the sync server to fetch this calendar.'
    putCalendarEntry(sub.id, { ...(cache[sub.id] ?? { events: [] }), error: message })
    return { ok: false, message }
  }
}

/** Parses a feed's text into the cache - the shared tail of fetch and import. */
export function absorb(id: string, text: string, from = todayKey()): FetchOutcome {
  const parsed = parseIcs(text, from, ICS_HORIZON_DAYS)
  if (parsed.events.length === 0 && parsed.ignored.length > 0) {
    // Nothing usable came out. Keeping whatever was there beats replacing a
    // working calendar with an empty one because a login page came back.
    const message = parsed.ignored[0]
    putCalendarEntry(id, { ...(cache[id] ?? { events: [] }), error: message, ignored: parsed.ignored })
    return { ok: false, message }
  }
  putCalendarEntry(id, {
    events: parsed.events,
    fetchedAt: new Date().toISOString(),
    ignored: parsed.ignored.length > 0 ? parsed.ignored : undefined,
  })
  return { ok: true }
}

/** "4 min ago", for the one line each calendar shows in Settings. */
export function formatFetchedAt(at: string | undefined, now = Date.now()): string {
  if (!at) return 'not yet'
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
