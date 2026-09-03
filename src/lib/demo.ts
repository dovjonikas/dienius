import type { AppData, Task, Template } from './types'
import { addDays, todayKey } from './dates'
import { weekdayOf } from './repeats'

/**
 * A week of plausible sample data.
 *
 * The point of a demo is not to show every feature; it is to show what the app
 * looks like in use, which is a different thing. So this is a fortnight of one
 * person's ordinary life - some days went well, one went badly, a book is
 * half read, two goals sit behind it all - rather than a tour of the feature
 * list. An empty app cannot make its own case, and neither can one stuffed
 * with every control switched on.
 *
 * Nothing here is random. A demo that generates a different week each time is
 * one you cannot screenshot, cannot describe, and cannot debug.
 */

export const DEMO_MARK = 'demo'

interface Seed {
  time: string
  title: string
  minutes: number
  category?: Task['category']
  core?: boolean
}

const WORKDAY: Seed[] = [
  { time: '07:30', title: 'Coffee and the plan', minutes: 20, category: 'routine' },
  { time: '08:00', title: 'Commute', minutes: 45, category: 'commute' },
  { time: '09:00', title: 'Deep work: pricing page', minutes: 120, category: 'core', core: true },
  { time: '11:15', title: 'Standup', minutes: 15, category: 'routine' },
  { time: '12:30', title: 'Lunch', minutes: 45, category: 'meal' },
  { time: '13:30', title: 'Code review', minutes: 60, category: 'core' },
  { time: '17:30', title: 'Gym', minutes: 60, category: 'health' },
  { time: '20:00', title: 'Read', minutes: 40, category: 'personal' },
]

const RESTDAY: Seed[] = [
  { time: '09:30', title: 'Slow breakfast', minutes: 45, category: 'meal' },
  { time: '11:00', title: 'Long walk', minutes: 90, category: 'health' },
  { time: '15:00', title: 'Call parents', minutes: 30, category: 'personal' },
  { time: '19:00', title: 'Cook something new', minutes: 60, category: 'meal' },
]

/**
 * How much of a past day got done.
 *
 * Hand-picked rather than random, and deliberately not a straight line: one
 * day near the start went badly. A demo where every day is 90% finished is a
 * brochure, and the whole argument of this app is that it is built for the
 * days that are not.
 */
const PAST_RATES = [0.75, 0.9, 0.35, 0.8, 1, 0.6, 0.85, 0.7, 0.95, 0.5]

/**
 * @param base a fresh `defaultData()`. Passed in rather than imported so this
 * module does not depend on storage.ts, which now depends on this one - the
 * sample week is what an empty demo key loads as.
 */
export function buildDemoData(base: AppData, today = todayKey()): AppData {

  const work: Template = {
    id: 'demo-template-work',
    name: 'Working day',
    color: '#a7c4f5',
    blocks: WORKDAY.map((s, i) => ({ id: `demo-template-work-${i}`, time: s.time, title: s.title, minutes: s.minutes, category: s.category, core: s.core })),
  }
  const rest: Template = {
    id: 'demo-template-rest',
    name: 'Rest day',
    color: '#cde39e',
    type: 'rest',
    blocks: RESTDAY.map((s, i) => ({ id: `demo-template-rest-${i}`, time: s.time, title: s.title, minutes: s.minutes, category: s.category })),
  }

  const days: AppData['days'] = {}
  // Ten days behind and three ahead. Behind is what makes the calendar and the
  // Review tab say anything; ahead is what makes the week view worth opening.
  for (let offset = -10; offset <= 3; offset += 1) {
    const date = addDays(today, offset)
    const weekend = weekdayOf(date) === 0 || weekdayOf(date) === 6
    const template = weekend ? rest : work
    const seeds = weekend ? RESTDAY : WORKDAY
    const rate = offset < 0 ? PAST_RATES[(offset + 10) % PAST_RATES.length] : offset === 0 ? 0.4 : 0

    days[date] = {
      date,
      templateId: template.id,
      dayType: template.type,
      tasks: seeds.map((seed, i) => ({
        id: `demo-${date}-${i}`,
        title: seed.title,
        time: seed.time,
        minutes: seed.minutes,
        category: seed.category,
        core: seed.core,
        // Finished from the top of the day down, which is how a day actually
        // empties - not a random scatter of ticks.
        done: i < Math.round(seeds.length * rate),
        fromTemplate: true,
        origin: { type: 'template' as const, sourceId: template.id, blockId: `${template.id}-${i}` },
        highlight: seed.core === true,
      })),
    }
  }

  // One carried task and one untimed one on today, because a real day has
  // both and a demo of a perfectly tidy day is a demo of nothing.
  days[today].tasks.push(
    {
      id: 'demo-pushed',
      title: 'Reply to the landlord',
      done: false,
      pushCount: 2,
      origin: { type: 'manual' },
    },
    {
      id: 'demo-float',
      title: 'Book the dentist',
      done: false,
      minutes: 15,
      category: 'personal',
      origin: { type: 'manual' },
    },
  )

  return {
    ...base,
    templates: [work, rest],
    days,
    goals: [
      {
        id: 'demo-goal-1',
        title: 'Ship something people keep using',
        why: 'Because everything I have built so far was rented.',
        identity: 'Someone who finishes.',
        createdAt: addDays(today, -60),
      },
      {
        id: 'demo-goal-2',
        title: 'Be strong at forty',
        why: 'My father stopped moving at fifty and never started again.',
        createdAt: addDays(today, -34),
      },
    ],
    ifThens: [
      { id: 'demo-if-1', trigger: 'If I open the laptop and do not know what to do', action: 'then I open today and do the first unticked thing', when: 'morning' },
      { id: 'demo-if-2', trigger: 'If it is past ten and I am still scrolling', action: 'then the phone goes in the other room', when: 'evening' },
    ],
    inbox: [
      { id: 'demo-inbox-1', text: 'Look into that cycling route', captured: addDays(today, -1) },
      { id: 'demo-inbox-2', text: 'Ask about the standing desk', captured: today },
    ],
    library: [
      {
        id: 'demo-list-1',
        name: 'Reading',
        unit: 'page',
        unitPlural: 'pages',
        items: [
          { id: 'demo-item-1', title: 'Thinking, Fast and Slow', total: 499, progress: 213 },
          { id: 'demo-item-2', title: 'The Design of Everyday Things', total: 368, progress: 368, finished: addDays(today, -12) },
        ],
      },
    ],
    settings: {
      ...base.settings,
      weekdayTemplates: { 1: work.id, 2: work.id, 3: work.id, 4: work.id, 5: work.id, 0: rest.id, 6: rest.id },
    },
  }
}
