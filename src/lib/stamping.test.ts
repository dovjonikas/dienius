import { applyStamps } from './stamping'
import type { DayPlan, Template } from './types'

const workDay: Template = {
  id: 't1',
  name: 'Work day',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'Gym' },
    { id: 'b2', time: '10:00', title: 'Deep work' },
  ],
}

test('applying a template copies its blocks as tasks', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const day = days['2026-09-01']
  expect(day.templateId).toBe('t1')
  expect(day.tasks).toHaveLength(2)
  expect(day.tasks[0]).toMatchObject({ time: '09:00', title: 'Gym', done: false, fromTemplate: true })
})

test('a stamped day arrives already sized when its template blocks carry minutes', () => {
  const sized: Template = {
    id: 't4',
    name: 'Full day',
    color: '#8ab6f9',
    blocks: [
      { id: 'b1', time: '09:00', title: 'Gym', minutes: 90 },
      { id: 'b2', title: 'Guitar', minutes: 20 },
      { id: 'b3', title: 'No size on this one' },
    ],
  }
  const days = applyStamps({}, [sized], { '2026-09-01': 't4' })
  const tasks = days['2026-09-01'].tasks
  expect(tasks.find(t => t.title === 'Gym')?.minutes).toBe(90)
  expect(tasks.find(t => t.title === 'Guitar')?.minutes).toBe(20)
  expect(tasks.find(t => t.title === 'No size on this one')?.minutes).toBeUndefined()
})

test('re-stamping updates minutes from the current block, not the prior task', () => {
  const shift: Template = {
    id: 't5',
    name: 'Shift',
    color: '#c9b3f0',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', minutes: 480 }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't5' })
  expect(stamped['2026-09-01'].tasks[0].minutes).toBe(480)

  const resized: Template = { ...shift, blocks: [{ ...shift.blocks[0], minutes: 420 }] }
  const restamped = applyStamps(stamped, [resized], { '2026-09-01': 't5' })
  expect(restamped['2026-09-01'].tasks[0].minutes).toBe(420)
})

test('applying keeps manual tasks and replaces old template tasks', () => {
  const existing: DayPlan = {
    date: '2026-09-01',
    templateId: 'old',
    tasks: [
      { id: 'x1', title: 'Old block', done: false, fromTemplate: true },
      { id: 'x2', title: 'Call mom', done: false },
    ],
  }
  const days = applyStamps({ '2026-09-01': existing }, [workDay], { '2026-09-01': 't1' })
  const titles = days['2026-09-01'].tasks.map(t => t.title)
  expect(titles).toEqual(['Gym', 'Deep work', 'Call mom'])
})

test('stamping null removes template tasks but keeps manual tasks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks.push({ id: 'm1', title: 'Manual', done: false })
  const cleared = applyStamps(stamped, [workDay], { '2026-09-01': null })
  expect(cleared['2026-09-01'].templateId).toBeUndefined()
  expect(cleared['2026-09-01'].tasks.map(t => t.title)).toEqual(['Manual'])
})

test('does not mutate the input days object', () => {
  const days: Record<string, DayPlan> = {}
  applyStamps(days, [workDay], { '2026-09-01': 't1' })
  expect(days).toEqual({})
})

test('unknown template id leaves the day untouched', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 'missing' })
  expect(days['2026-09-01']).toBeUndefined()
})

test('re-stamping the same template preserves done state of matching blocks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const gymId = stamped['2026-09-01'].tasks.find(t => t.title === 'Gym')!.id
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t =>
    t.id === gymId ? { ...t, done: true } : t,
  )
  const restamped = applyStamps(stamped, [workDay], { '2026-09-01': 't1' })
  const tasks = restamped['2026-09-01'].tasks
  expect(tasks.find(t => t.title === 'Gym')?.done).toBe(true)
  expect(tasks.find(t => t.title === 'Deep work')?.done).toBe(false)
})

test('re-stamping after a block is removed from the template drops its task', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t =>
    t.title === 'Gym' ? { ...t, done: true } : t,
  )
  const shrunk: Template = { ...workDay, blocks: [workDay.blocks[1]] }
  const restamped = applyStamps(stamped, [shrunk], { '2026-09-01': 't1' })
  const titles = restamped['2026-09-01'].tasks.map(t => t.title)
  expect(titles).toEqual(['Deep work'])
})

test('re-stamping after a block is added to the template arrives unchecked', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => ({ ...t, done: true }))
  const grown: Template = {
    ...workDay,
    blocks: [...workDay.blocks, { id: 'b3', time: '18:00', title: 'Dinner' }],
  }
  const restamped = applyStamps(stamped, [grown], { '2026-09-01': 't1' })
  const dinner = restamped['2026-09-01'].tasks.find(t => t.title === 'Dinner')
  expect(dinner?.done).toBe(false)
  expect(restamped['2026-09-01'].tasks.find(t => t.title === 'Gym')?.done).toBe(true)
})

test('re-stamping the same template still keeps manual tasks', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks.push({ id: 'm1', title: 'Manual task', done: true })
  const restamped = applyStamps(stamped, [workDay], { '2026-09-01': 't1' })
  const manual = restamped['2026-09-01'].tasks.find(t => t.title === 'Manual task')
  expect(manual?.done).toBe(true)
  expect(manual?.fromTemplate).toBeFalsy()
})

test('stamping a typed template carries the type onto the day', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [
      { id: 'b1', time: '19:00', title: 'Clock in', core: true },
      { id: 'b2', time: '21:00', title: 'Break', core: false },
    ],
  }
  const days = applyStamps({}, [shift], { '2026-09-01': 't3' })
  const day = days['2026-09-01']
  expect(day.dayType).toBe('shift')
  expect(day.tasks.find(t => t.title === 'Clock in')?.core).toBe(true)
  expect(day.tasks.find(t => t.title === 'Break')?.core).toBeFalsy()
})

test('stamping a template with no type leaves dayType absent, same as an old template', () => {
  const days = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  expect(days['2026-09-01'].dayType).toBeUndefined()
})

test('clearing a stamp drops the day type along with the template', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', core: true }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't3' })
  const cleared = applyStamps(stamped, [shift], { '2026-09-01': null })
  expect(cleared['2026-09-01'].dayType).toBeUndefined()
})

test('re-stamping updates core from the current block, not the prior task', () => {
  const shift: Template = {
    id: 't3',
    name: 'Night shift',
    color: '#c9b3f0',
    type: 'shift',
    blocks: [{ id: 'b1', time: '19:00', title: 'Clock in', core: false }],
  }
  const stamped = applyStamps({}, [shift], { '2026-09-01': 't3' })
  expect(stamped['2026-09-01'].tasks[0].core).toBeFalsy()

  const nowCore: Template = { ...shift, blocks: [{ ...shift.blocks[0], core: true }] }
  const restamped = applyStamps(stamped, [nowCore], { '2026-09-01': 't3' })
  expect(restamped['2026-09-01'].tasks[0].core).toBe(true)
})

test('stamping a block marked unbounded copies the flag onto the task it produces', () => {
  const withStanding: Template = {
    id: 't5',
    name: 'Ongoing project',
    color: '#c9b3f0',
    blocks: [
      { id: 'b1', time: '19:00', title: 'Standing item', unbounded: true },
      { id: 'b2', time: '21:00', title: 'Ordinary item' },
    ],
  }
  const days = applyStamps({}, [withStanding], { '2026-09-01': 't5' })
  const tasks = days['2026-09-01'].tasks
  expect(tasks.find(t => t.title === 'Standing item')?.unbounded).toBe(true)
  expect(tasks.find(t => t.title === 'Ordinary item')?.unbounded).toBeFalsy()
})

test('re-stamping updates unbounded from the current block, not the prior task', () => {
  const template: Template = {
    id: 't6',
    name: 'Ongoing project',
    color: '#c9b3f0',
    blocks: [{ id: 'b1', time: '19:00', title: 'Standing item', unbounded: false }],
  }
  const stamped = applyStamps({}, [template], { '2026-09-01': 't6' })
  expect(stamped['2026-09-01'].tasks[0].unbounded).toBeFalsy()

  const nowUnbounded: Template = { ...template, blocks: [{ ...template.blocks[0], unbounded: true }] }
  const restamped = applyStamps(stamped, [nowUnbounded], { '2026-09-01': 't6' })
  expect(restamped['2026-09-01'].tasks[0].unbounded).toBe(true)
})

test('applying a different template does not carry over done state', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => ({ ...t, done: true }))
  const other: Template = {
    id: 't2',
    name: 'Rest day',
    color: '#f5b0a7',
    blocks: [{ id: 'c1', time: '09:00', title: 'Gym' }],
  }
  const restamped = applyStamps(stamped, [workDay, other], { '2026-09-01': 't2' })
  expect(restamped['2026-09-01'].tasks.find(t => t.title === 'Gym')?.done).toBe(false)
})

// The note and the steps a template carries onto a day - the field that did
// not exist until v2.11, so a template could hold a recipe and never deliver
// it. See the rule in stamping.ts: `match?.note ?? b.note`.

const withNote: Template = {
  id: 't-note',
  name: 'Meals',
  color: '#8ab6f9',
  blocks: [
    {
      id: 'nb1',
      time: '12:00',
      title: 'Meal',
      note: 'Rice, chicken, whatever green is in the fridge.\n  200 g rice\n  300 g chicken',
    },
    { id: 'nb2', time: '18:00', title: 'Evening close' },
  ],
}

test("a template's note reaches a fresh day", () => {
  const days = applyStamps({}, [withNote], { '2026-09-01': 't-note' })
  const meal = days['2026-09-01'].tasks.find(t => t.title === 'Meal')
  expect(meal?.note).toBe('Rice, chicken, whatever green is in the fridge.\n  200 g rice\n  300 g chicken')
  // And a block with nothing to say still says nothing, rather than an
  // empty string that would light the card's note mark.
  expect(days['2026-09-01'].tasks.find(t => t.title === 'Evening close')?.note).toBeUndefined()
})

test("a day's own note wins over the template's, and re-stamping does not erase it", () => {
  const stamped = applyStamps({}, [withNote], { '2026-09-01': 't-note' })
  const written = {
    ...stamped,
    '2026-09-01': {
      ...stamped['2026-09-01'],
      tasks: stamped['2026-09-01'].tasks.map(t =>
        t.title === 'Meal' ? { ...t, note: 'Used the last of the rice - buy more' } : t,
      ),
    },
  }
  const edited: Template = {
    ...withNote,
    blocks: withNote.blocks.map(b => (b.id === 'nb1' ? { ...b, note: 'Something else entirely' } : b)),
  }
  const again = applyStamps(written, [edited], { '2026-09-01': 't-note' })
  expect(again['2026-09-01'].tasks.find(t => t.title === 'Meal')?.note).toBe('Used the last of the rice - buy more')
})

test("editing a template's note reaches every day nobody wrote on", () => {
  const stamped = applyStamps({}, [withNote], { '2026-09-01': 't-note' })
  const edited: Template = {
    ...withNote,
    blocks: withNote.blocks.map(b => (b.id === 'nb1' ? { ...b, note: 'Pasta this week' } : b)),
  }
  const again = applyStamps(stamped, [edited], { '2026-09-01': 't-note' })
  expect(again['2026-09-01'].tasks.find(t => t.title === 'Meal')?.note).toBe('Pasta this week')
})

// KEY on a template block: the same shape as the note, and the cap that
// makes three mean three.

const withKey: Template = {
  id: 't-key',
  name: 'Workday',
  color: '#8ab6f9',
  blocks: [
    { id: 'kb1', time: '07:00', title: 'Morning routine', highlight: true },
    { id: 'kb2', time: '09:00', title: 'Deep work', highlight: true },
    { id: 'kb3', time: '13:00', title: 'Lunch' },
  ],
}

test("a template's key tasks reach a fresh day", () => {
  const days = applyStamps({}, [withKey], { '2026-09-01': 't-key' })
  const marked = days['2026-09-01'].tasks.filter(t => t.highlight).map(t => t.title)
  expect(marked).toEqual(['Morning routine', 'Deep work'])
})

test('KEY taken off on the day is not handed back by a re-stamp', () => {
  const stamped = applyStamps({}, [withKey], { '2026-09-01': 't-key' })
  // This is what toggleTaskHighlight writes: false, not absent. The whole
  // rule rests on it.
  const cleared: Record<string, DayPlan> = {
    ...stamped,
    '2026-09-01': {
      ...stamped['2026-09-01'],
      tasks: stamped['2026-09-01'].tasks.map(t => (t.title === 'Deep work' ? { ...t, highlight: false } : t)),
    },
  }
  const again = applyStamps(cleared, [withKey], { '2026-09-01': 't-key' })
  expect(again['2026-09-01'].tasks.find(t => t.title === 'Deep work')?.highlight).toBe(false)
  expect(again['2026-09-01'].tasks.find(t => t.title === 'Morning routine')?.highlight).toBe(true)
})

test('KEY added on the day survives a re-stamp of a block that does not carry it', () => {
  const stamped = applyStamps({}, [withKey], { '2026-09-01': 't-key' })
  const marked: Record<string, DayPlan> = {
    ...stamped,
    '2026-09-01': {
      ...stamped['2026-09-01'],
      tasks: stamped['2026-09-01'].tasks.map(t => (t.title === 'Lunch' ? { ...t, highlight: true } : t)),
    },
  }
  const again = applyStamps(marked, [withKey], { '2026-09-01': 't-key' })
  expect(again['2026-09-01'].tasks.find(t => t.title === 'Lunch')?.highlight).toBe(true)
})

test('a template carrying four key blocks stamps three, keeps them all, and takes the earliest', () => {
  const tooMany: Template = {
    id: 't-four',
    name: 'Too much matters',
    color: '#8ab6f9',
    blocks: [
      { id: 'a', time: '13:00', title: 'Afternoon', highlight: true },
      { id: 'b', time: '07:00', title: 'Morning', highlight: true },
      { id: 'c', title: 'Whenever', highlight: true },
      { id: 'd', time: '09:00', title: 'Mid-morning', highlight: true },
    ],
  }
  const day = applyStamps({}, [tooMany], { '2026-09-01': 't-four' })['2026-09-01']
  // Nothing dropped: the cap is about how many things can matter, not how
  // many things there are.
  expect(day.tasks).toHaveLength(4)
  expect(day.tasks.filter(t => t.highlight).map(t => t.title).sort()).toEqual([
    'Afternoon',
    'Mid-morning',
    'Morning',
  ])
  // The untimed one is last in the queue, not first.
  expect(day.tasks.find(t => t.title === 'Whenever')?.highlight).toBe(false)
})

test("a key task the person put on a manual entry is not taken away by a stamp", () => {
  const withManual: Record<string, DayPlan> = {
    '2026-09-01': {
      date: '2026-09-01',
      tasks: [
        { id: 'm1', title: 'Call the bank', done: false, time: '11:00', highlight: true },
        { id: 'm2', title: 'Post the form', done: false, time: '12:00', highlight: true },
      ],
    },
  }
  const day = applyStamps(withManual, [withKey], { '2026-09-01': 't-key' })['2026-09-01']
  // Both of the person's own stay, and the template gets the one place left.
  expect(day.tasks.filter(t => t.highlight).map(t => t.title).sort()).toEqual([
    'Call the bank',
    'Morning routine',
    'Post the form',
  ])
  expect(day.tasks).toHaveLength(5)
})

test('core is not read as KEY, in either direction', () => {
  const coreOnly: Template = {
    id: 't-core',
    name: 'Shift',
    color: '#8ab6f9',
    type: 'shift',
    blocks: [{ id: 'c1', time: '08:00', title: 'The shift', core: true }],
  }
  const day = applyStamps({}, [coreOnly], { '2026-09-01': 't-core' })['2026-09-01']
  expect(day.tasks[0].core).toBe(true)
  expect(day.tasks[0].highlight).toBeFalsy()
})
