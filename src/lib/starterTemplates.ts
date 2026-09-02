import type { DayType } from './types'
import type { CategoryId } from './categories'
import { PALETTE_COLORS } from './colors'

/**
 * One block on a starter offer - the same shape `TemplateEditor` builds by
 * hand in `TemplatesView.tsx`, just written directly instead of typed in.
 */
export interface StarterBlock {
  time?: string
  title: string
  minutes?: number
  core?: boolean
  /**
   * Every starter block carries one - see `categories.ts`. A first-run day
   * that arrives in a single colour teaches that the colours mean nothing;
   * these are picked so that tapping one offer shows an actual coloured day,
   * with work, meals, travel and the rest visibly different from each other.
   */
  category: CategoryId
}

/**
 * A starter template is data, not a component - the card that renders it
 * (`StarterOffers.tsx`) and the two places that offer it (the day view's
 * first-run state, the templates list's empty state) both read from here.
 * Nothing here touches storage: an offer only becomes a real, editable
 * `Template` once `starterTemplateInput` is handed to `actions.addTemplate`,
 * which happens only on a tap - see `docs/DECISIONS.md`, "offer without
 * installing."
 */
export interface StarterTemplate {
  id: string
  name: string
  color: string
  type: DayType
  /** One line shown on the offer card, under the name. */
  description: string
  blocks: StarterBlock[]
}

const [BLUE, , GREEN, , LAVENDER] = PALETTE_COLORS

/**
 * Three realistic shapes, not three demos: a new person's very first
 * impression of what a Dienius template looks like comes from these, so
 * each one is written as an actual day rather than a scaffold of "Task 1,
 * Task 2." A working day is scored on everything, the way a full day
 * always has been in this app; the other two are scored only on their core
 * blocks - one required thing on the rest day, one shift itself on the
 * night day - so tapping either one also shows what a reduced score looks
 * like without a word of explanation needed.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'working-day',
    name: 'Working day',
    color: BLUE.value,
    type: 'full',
    description: 'A weekday built around one long work block, with the edges left open.',
    blocks: [
      { time: '07:30', title: 'Get up, shower, coffee', minutes: 45, category: 'routine' },
      { time: '08:15', title: 'Commute', minutes: 30, category: 'commute' },
      { time: '09:00', title: 'Deep work block', minutes: 120, category: 'core' },
      { time: '11:00', title: 'Standup', minutes: 15, category: 'core' },
      { time: '12:30', title: 'Lunch', minutes: 45, category: 'meal' },
      { time: '13:30', title: 'Meetings', minutes: 90, category: 'core' },
      { time: '15:30', title: 'Admin and email', minutes: 45, category: 'core' },
      { time: '17:00', title: 'Commute home', minutes: 30, category: 'commute' },
      { time: '19:00', title: 'Dinner', minutes: 45, category: 'meal' },
    ],
  },
  {
    id: 'rest-day',
    name: 'Rest day',
    color: GREEN.value,
    type: 'rest',
    description: 'Mostly open. Only one thing on it actually has to happen.',
    blocks: [
      { time: '09:30', title: 'Take morning medication', minutes: 5, core: true, category: 'health' },
      { title: 'Sleep in, no alarm', category: 'routine' },
      { time: '11:00', title: 'Slow breakfast', minutes: 30, category: 'meal' },
      { title: 'Load of laundry', minutes: 30, category: 'routine' },
      { title: 'Walk outside', minutes: 45, category: 'health' },
      { title: 'Read or watch something', minutes: 60, category: 'personal' },
    ],
  },
  {
    id: 'night-shift',
    name: 'Night shift',
    color: LAVENDER.value,
    type: 'night',
    description: 'Anchored around the shift itself. Everything else only counts if it happens.',
    blocks: [
      { time: '20:30', title: 'Eat before heading in', minutes: 30, category: 'meal' },
      { time: '21:15', title: 'Commute to work', minutes: 30, category: 'commute' },
      { time: '22:00', title: 'On shift', minutes: 480, core: true, category: 'core' },
      { time: '06:30', title: 'Commute home', minutes: 30, category: 'commute' },
      { time: '07:15', title: 'Wind down and sleep', minutes: 30, category: 'routine' },
      { title: 'Check messages', minutes: 15, category: 'personal' },
    ],
  },
]

/** The exact input shape `actions.addTemplate` in `store.ts` takes, mirrored
 * here rather than imported so this module - pure data plus a pure mapping
 * - never has to pull in the store and everything it drags with it. */
export interface StarterTemplateInput {
  name: string
  color: string
  type: DayType
  blocks: { time?: string; title: string; core?: boolean; minutes?: number; category?: CategoryId }[]
}

/**
 * Turns a starter offer into exactly the input shape `actions.addTemplate`
 * takes. A pure mapping, kept separate from the tap handler that calls it
 * so the mapping itself is testable with no store or DOM involved.
 */
export function starterTemplateInput(starter: StarterTemplate): StarterTemplateInput {
  return {
    name: starter.name,
    color: starter.color,
    type: starter.type,
    blocks: starter.blocks.map(b => ({
      time: b.time,
      title: b.title,
      minutes: b.minutes,
      core: b.core,
      category: b.category,
    })),
  }
}
