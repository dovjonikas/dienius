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
  { time: '14:45', title: 'Draft the launch email', minutes: 60, category: 'core' },
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
 *
 * The last one - yesterday - is a full day, on purpose. Yesterday with
 * something left on it puts the "Yesterday: 3 unfinished" banner on the first
 * screen a visitor sees, above a day they have not looked at yet, and the
 * first screen has room for the day and nothing else. The banner is real and
 * the demo shows it - the moment the visitor's own clock crosses midnight and
 * today's unfinished blocks become yesterday's - just not before they have
 * seen the plan it interrupts.
 */
const PAST_RATES = [0.75, 0.9, 0.35, 0.8, 0.5, 0.6, 0.85, 0.7, 0.95, 1]

/**
 * Today is finished up to the clock, and never earlier than one o'clock.
 *
 * A past day is a rate; today cannot be, because a demo opened at four in the
 * afternoon with the morning coffee still unticked reads as a day nobody
 * lived, and one opened at nine with the evening read already done reads as
 * a lie. So today's ticks follow the clock: a block is done if it ended
 * before now. The floor is what keeps the demo from opening on a bare
 * morning - somebody looking at the sample at eight sees the day as it
 * stood after lunch, which is the state the whole design is about: some of
 * it done, some of it not, something running.
 */
const TODAY_FLOOR_MINUTES = 13 * 60

function minutesOfDayNow(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function endOf(seed: Seed): number {
  const [h, m] = seed.time.split(':').map(Number)
  return h * 60 + m + seed.minutes
}

/**
 * @param base a fresh `defaultData()`. Passed in rather than imported so this
 * module does not depend on storage.ts, which now depends on this one - the
 * sample week is what an empty demo key loads as.
 */
export function buildDemoData(base: AppData, today = todayKey(), nowMinutes = minutesOfDayNow()): AppData {
  const doneUntil = Math.max(nowMinutes, TODAY_FLOOR_MINUTES)

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
    const rate = offset < 0 ? PAST_RATES[(offset + 10) % PAST_RATES.length] : 0

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
        // empties - not a random scatter of ticks. Today follows the clock
        // instead of a rate, so the ticks stop where the afternoon has got to.
        done: offset === 0 ? endOf(seed) <= doneUntil : i < Math.round(seeds.length * rate),
        fromTemplate: true,
        origin: { type: 'template' as const, sourceId: template.id, blockId: `${template.id}-${i}` },
        highlight: seed.core === true,
      })),
    }
  }

  // The evening read is a session of the book being read, so the day names
  // the book rather than the word "Read" - the same thing a stamped
  // template does when a block is bound to a list.
  const read = days[today].tasks.find(t => t.title === 'Read')
  if (read) {
    read.title = 'Thinking, Fast and Slow'
    read.libraryRef = { listId: 'demo-list-1', itemId: 'demo-item-1' }
  }
  // Yesterday kept its best moment, which is what the calendar shows for it.
  days[addDays(today, -1)].bestMoment = 'The walk back, no headphones'

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
  // One task with something behind the card: a note and sub-steps, so the
  // detail sheet has a reason to be opened on the sample.
  const email = days[today].tasks.find(t => t.title === 'Draft the launch email')
  if (email) {
    email.note = 'Lead with the price change. Keep it under two hundred words.'
    email.subtasks = [
      { id: 'demo-sub-1', title: 'Outline', done: true },
      { id: 'demo-sub-2', title: 'First draft', done: false },
      { id: 'demo-sub-3', title: 'Read it out loud once', done: false },
    ]
  }

  return {
    ...base,
    templates: [work, rest],
    days,
    // The picture over the goals: a few lines in the first person, the way
    // the North window asks for it. Sample copy, like the goals.
    picture: {
      text:
        'I wake before the house does and the first hour is mine.\n' +
        'I ship small things on Fridays and I do not apologise for them.\n' +
        'People ask me how the training is going, and I have an answer.',
    },
    goals: [
      {
        id: 'demo-goal-1',
        title: 'Ship something people keep using',
        why: 'Because everything I have built so far was rented.',
        identity: 'Someone who finishes.',
        deserve: ['open the editor before the inbox', 'ship one small thing every Friday'],
        createdAt: addDays(today, -60),
      },
      {
        id: 'demo-goal-2',
        title: 'Be strong at forty',
        why: 'My father stopped moving at fifty and never started again.',
        deserve: ['train three mornings a week', 'walk after lunch', 'in bed by eleven'],
        createdAt: addDays(today, -34),
      },
    ],
    // Each one under the goal it protects - that is the whole of what a rule
    // is for. The trigger and the action are written without "If" and "then"
    // in the strings: the line puts those in itself, and the sample data
    // carried them for two versions, so the demo read "If If I open the
    // laptop" wherever a rule was drawn.
    ifThens: [
      {
        id: 'demo-if-1',
        goalId: 'demo-goal-1',
        trigger: 'I open the laptop and do not know what to do',
        action: 'I open today and do the first unticked thing',
      },
      {
        id: 'demo-if-2',
        goalId: 'demo-goal-1',
        trigger: 'it is past ten and I am still scrolling',
        action: 'the phone goes in the other room',
      },
      {
        id: 'demo-if-3',
        goalId: 'demo-goal-2',
        trigger: 'I am too tired to train properly',
        action: 'I go anyway and do half of it',
      },
    ],
    inbox: [
      { id: 'demo-inbox-1', text: 'Look into that cycling route', captured: addDays(today, -1) },
      { id: 'demo-inbox-2', text: 'Ask about the standing desk', captured: today },
    ],
    // Decided, undated, in the order they would be pulled - the fourth
    // shelf. Sized and coloured so a pull onto the day carries both.
    backlog: [
      { id: 'demo-backlog-1', title: 'Renew the passport', category: 'personal', minutes: 30 },
      { id: 'demo-backlog-2', title: 'Sort the photo archive', category: 'personal', minutes: 90 },
      { id: 'demo-backlog-3', title: 'Try the new climbing gym', category: 'health' },
    ],
    // The stream under everything else: a number said once, a bug noticed
    // while doing something else. One carries the #bug tag the export reads.
    scratch: [
      { id: 'demo-scratch-1', text: 'Locker 214, code 7731', createdAt: `${addDays(today, -2)}T18:40:00.000Z`, date: addDays(today, -2) },
      { id: 'demo-scratch-2', text: '#bug the week view loses the chip when the window is narrowed', createdAt: `${addDays(today, -1)}T10:05:00.000Z`, date: addDays(today, -1) },
      { id: 'demo-scratch-3', text: 'Ask Rita about the Thursday slot', createdAt: `${today}T09:12:00.000Z`, date: today, pinned: true },
    ],
    library: [
      {
        id: 'demo-list-1',
        name: 'Reading',
        unit: 'chapter',
        unitShort: 'ch',
        color: '#a7c4f5',
        items: [
          { id: 'demo-item-1', title: 'Thinking, Fast and Slow', track: 'pages', total: 499, progress: 213, pace: 'a chapter most evenings' },
          { id: 'demo-item-3', title: 'Deep Work', total: 7, progress: 2, pace: 'weekends' },
          { id: 'demo-item-4', title: 'Project Hail Mary', total: 30 },
          { id: 'demo-item-2', title: 'The Design of Everyday Things', track: 'pages', total: 368, progress: 368, finished: addDays(today, -12) },
        ],
      },
      {
        id: 'demo-list-2',
        name: 'Watching',
        unit: 'episode',
        unitShort: 'ep',
        color: '#e6b8c8',
        items: [
          { id: 'demo-item-5', title: 'The Bear', track: 'series', seasons: 3, season: 2, total: 10, progress: 4, pace: 'one a night, never two' },
          { id: 'demo-item-6', title: 'Past Lives', track: 'movie' },
          { id: 'demo-item-7', title: 'Severance', track: 'series', seasons: 2, season: 2, total: 10, progress: 10, finished: addDays(today, -5) },
        ],
      },
    ],
    settings: {
      ...base.settings,
      weekdayTemplates: { 1: work.id, 2: work.id, 3: work.id, 4: work.id, 5: work.id, 0: rest.id, 6: rest.id },
    },
  }
}
