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

/**
 * Erasing a stamp takes the template off the day and nothing else. Found in
 * the audit for rotating shifts, where a date's kind is its stamp and
 * clearing a kind goes through this path: the day came back as its date and
 * its hand-written tasks, and its journal, its sleep schedule, its skipped
 * repeats, its low day, its replan mark and its time away went with the
 * template.
 */
test('stamping null keeps everything the day had besides the template', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const day: DayPlan = {
    ...stamped['2026-09-01'],
    journal: 'A line written on the day.',
    sleepProfileId: 'shift',
    repeatSkips: ['r1'],
    autoApplied: true,
    lowDay: true,
    replannedOn: '2026-09-01',
    away: '14:00',
    updatedAt: '2026-09-01T08:00:00.000Z',
    tasks: [...stamped['2026-09-01'].tasks, { id: 'm1', title: 'Manual', done: false }],
  }
  const cleared = applyStamps({ '2026-09-01': day }, [workDay], { '2026-09-01': null })['2026-09-01']
  expect(cleared).toEqual({
    date: '2026-09-01',
    journal: 'A line written on the day.',
    sleepProfileId: 'shift',
    repeatSkips: ['r1'],
    autoApplied: true,
    lowDay: true,
    replannedOn: '2026-09-01',
    away: '14:00',
    updatedAt: '2026-09-01T08:00:00.000Z',
    tasks: [{ id: 'm1', title: 'Manual', done: false }],
  })
})

/**
 * A task moved onto a day from another day keeps the mark of the template it
 * came from, and stamping read every task with that mark as the day's own
 * template's - so a stamp of anything else, or of nothing, dropped it. Found
 * in the audit for rotating shifts, where changing a date's kind is exactly
 * such a stamp.
 */
test('a task moved in from another template stays when the day is stamped with a different one, or with none', () => {
  const other: Template = { id: 't2', name: 'Other', color: '#f9d48a', blocks: [{ id: 'o1', time: '18:00', title: 'Swim' }] }
  const third: Template = { id: 't3', name: 'Third', color: '#a7c4f5', blocks: [{ id: 'c1', time: '07:00', title: 'Walk' }] }
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const movedIn = {
    id: 'moved',
    title: 'Swim',
    time: '18:00',
    done: false,
    fromTemplate: true,
    origin: { type: 'template' as const, sourceId: 't2', blockId: 'o1' },
  }
  const day: DayPlan = { ...stamped['2026-09-01'], tasks: [...stamped['2026-09-01'].tasks, movedIn] }
  const templates = [workDay, other, third]

  const restamped = applyStamps({ '2026-09-01': day }, templates, { '2026-09-01': 't3' })['2026-09-01']
  expect(restamped.tasks.map(t => t.title)).toEqual(['Walk', 'Swim'])
  expect(restamped.tasks.find(t => t.title === 'Swim')?.id).toBe('moved')

  const erased = applyStamps({ '2026-09-01': day }, templates, { '2026-09-01': null })['2026-09-01']
  expect(erased.tasks.map(t => t.id)).toEqual(['moved'])

  // And the day's own template's tasks still go when another comes, the way they always did.
  expect(restamped.tasks.some(t => t.title === 'Gym' || t.title === 'Deep work')).toBe(false)
})

test('a task moved in from the template being stamped is the one its block keeps, not a second copy', () => {
  const other: Template = { id: 't2', name: 'Other', color: '#f9d48a', blocks: [{ id: 'o1', time: '18:00', title: 'Swim' }] }
  const day: DayPlan = {
    date: '2026-09-01',
    tasks: [{ id: 'moved', title: 'Swim', time: '18:00', done: true, fromTemplate: true, origin: { type: 'template', sourceId: 't2', blockId: 'o1' } }],
  }
  const stamped = applyStamps({ '2026-09-01': day }, [workDay, other], { '2026-09-01': 't2' })['2026-09-01']
  expect(stamped.tasks).toHaveLength(1)
  expect(stamped.tasks[0]).toMatchObject({ id: 'moved', done: true })
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

test('re-stamping after a block is removed from the template drops its task, unless it was ticked', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  const shrunk: Template = { ...workDay, blocks: [workDay.blocks[1]] }
  expect(applyStamps(stamped, [shrunk], { '2026-09-01': 't1' })['2026-09-01'].tasks.map(t => t.title)).toEqual(['Deep work'])
  // Ticked, it is what the day did, and stays - the shift brief of 2026-09-25, stage 4.
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => (t.title === 'Gym' ? { ...t, done: true } : t))
  const restamped = applyStamps(stamped, [shrunk], { '2026-09-01': 't1' })
  expect(restamped['2026-09-01'].tasks.map(t => t.title).sort()).toEqual(['Deep work', 'Gym'])
})

test('another template stamped over a day keeps what was ticked of the one going out, and so does taking it off', () => {
  const stamped = applyStamps({}, [workDay], { '2026-09-01': 't1' })
  stamped['2026-09-01'].tasks = stamped['2026-09-01'].tasks.map(t => (t.title === 'Gym' ? { ...t, done: true } : t))
  const other: Template = { id: 't2', name: 'Another day', color: '#a7e3bd', blocks: [{ id: 'o1', time: '10:00', title: 'Walk' }] }
  const over = applyStamps(stamped, [workDay, other], { '2026-09-01': 't2' })
  expect(over['2026-09-01'].tasks.map(t => [t.title, t.done])).toEqual([['Walk', false], ['Gym', true]])
  const off = applyStamps(stamped, [workDay], { '2026-09-01': null })
  expect(off['2026-09-01'].tasks.map(t => [t.title, t.done])).toEqual([['Gym', true]])
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

// --- a meal's recipe - Kitchen, since v2.27 ----------------------------------------

test("a meal block's recipe, or its kind of meal, reaches the day with the echo, and a re-stamp takes the block's current one", () => {
  const meals: Template = {
    id: 'meals',
    name: 'Meals',
    color: '#8ab6f9',
    blocks: [
      { id: 'lunch', time: '12:30', title: 'Lunch', category: 'meal', recipeId: 'soup' },
      { id: 'dinner', time: '19:00', title: 'Dinner', category: 'meal', mealType: 'dinner' },
      { id: 'walk', time: '13:00', title: 'Walk', category: 'health' },
    ],
  }
  const stamped = applyStamps({}, [meals], { '2026-09-01': 'meals' })
  const [lunch, dinner, walk] = stamped['2026-09-01'].tasks
  expect(lunch).toMatchObject({ recipeId: 'soup', fromBlock: { recipeId: 'soup' } })
  expect(lunch.mealType).toBeUndefined()
  expect(dinner).toMatchObject({ mealType: 'dinner', fromBlock: { mealType: 'dinner' } })
  expect(walk.recipeId).toBeUndefined()
  expect(walk.mealType).toBeUndefined()

  const changed: Template = { ...meals, blocks: [{ ...meals.blocks[0], recipeId: 'oats' }, meals.blocks[1], meals.blocks[2]] }
  const restamped = applyStamps(stamped, [changed], { '2026-09-01': 'meals' })
  expect(restamped['2026-09-01'].tasks[0].recipeId).toBe('oats')
})
