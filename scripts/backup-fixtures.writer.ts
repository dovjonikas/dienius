// The writer scripts/backup-fixtures.mjs copies into a worktree of an older
// commit and runs there as a test: the plan that version itself makes of the
// sample day and of a generic overlay of every field its guard knew, loaded
// through its own migrations and written by its own exportJson to
// FIXTURE_OUT. Never run here - it imports that version's storage, not this
// one's, which is why tsconfig leaves it out.
import { expect, test, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { exportJson, loadData } from './storage'

/** The commits in order, from the script; a field is written from the commit that brought it. */
const ORDER = (process.env.FIXTURE_ORDER ?? '').split(',')
const STEP = ORDER.indexOf(process.env.FIXTURE_COMMIT as string)
const since = (commit: string) => STEP >= ORDER.indexOf(commit)

type Loose = any

function overlay(p: Loose, stamp: string): void {
  const u = { updatedAt: stamp }
  const t = (o: Loose) => ({ done: false, ...o, ...u })

  p.categories.push({ id: 'fx-errands', label: 'Errands', color: '#5b8def', ...(since('2c5f9c1') ? { endsItself: true } : {}), ...u })
  p.settings.sleepProfiles.push({ id: 'fx-after-night', name: 'After a night', window: { start: '08:00', end: '15:00' } })
  if (since('9f4b45f')) p.settings.north = { ...p.settings.north, stripOnDay: false }
  if (since('c007815')) p.settings.north.windowAfterSleep = false
  if (since('44a6638')) p.settings.mealWords = [{ word: 'Soup', meals: ['lunch', 'dinner'] }]
  p.settingsUpdatedAt = stamp
  p.tombstones = { ...(p.tombstones ?? {}), 'task:fx-gone': stamp }

  const nightBlocks: Loose[] = [
    { id: 'fx-n1', title: 'Night shift', time: '21:00', minutes: 600, category: 'core', core: true, highlight: true, note: 'Badge and keys', noteExpanded: true },
  ]
  if (since('41d4e3e')) nightBlocks.push({ id: 'fx-n2', title: 'Meal break', time: '01:00', minutes: 20, afterMidnight: true, ...(since('4e02c1c') ? { mealType: 'snack' } : {}) })
  p.templates.push({ id: 'fx-night', name: 'Night', color: '#44507a', type: 'night', sleepProfileId: 'fx-after-night', blocks: nightBlocks, ...(since('a88173b') ? { dayKind: { letter: 'N', order: 5 } } : {}), ...u })
  p.templates.push({
    id: 'fx-week', name: 'A week', color: '#6d8f5e', kind: 'week', weekDays: { 6: { type: 'rest', sleepProfileId: 'default' } }, ...u,
    blocks: [
      { id: 'fx-w1', title: 'Run', time: '07:00', minutes: 30, category: 'health', weekday: 1, groupId: 'fx-g1' },
      { id: 'fx-w2', title: 'Run', time: '07:00', minutes: 30, category: 'health', weekday: 3, groupId: 'fx-g1' },
      { id: 'fx-w3', title: 'Long walk', minutes: 90, category: 'health', weekday: 6, unbounded: true },
    ],
  })
  if (since('a88173b')) {
    p.templates.push({ id: 'fx-rest', name: 'Rest', color: '#8a8f98', type: 'rest', blocks: [], dayKind: { letter: 'Z', order: 6, ...(since('c921fdf') ? { afterNight: 'fx-after' } : {}) }, ...u })
    if (since('c921fdf')) p.templates.push({ id: 'fx-after', name: 'After a night', color: '#7a6f98', type: 'rest', sleepProfileId: 'fx-after-night', blocks: [], dayKind: { letter: 'A', order: 7 }, ...u })
    ;(p.routines ??= []).push({
      id: 'fx-routine', title: 'Stretch', category: 'health', minutes: 30, weekdays: [1, 2, 3, 4, 5], times: { 'fx-rest': '17:00' },
      ...(since('db244a8') ? { kindMinutes: { 'fx-rest': 45 }, core: true } : {}), ...u,
    })
  }
  if (since('4e02c1c')) {
    const blocks: Loose[] = [{ id: 'fx-m1', title: 'Dinner', time: '19:00', minutes: 30, category: 'meal', recipeId: 'fx-recipe', mealType: 'dinner', ...(since('8a13a11') ? { recipeIds: ['fx-recipe', 'fx-recipe2'] } : {}) }]
    if (since('44a6638')) blocks.push({ id: 'fx-m2', title: 'Lunch', time: '12:30', minutes: 30, category: 'meal', mealType: 'lunch', followMeal: true })
    if (since('d3e4411')) blocks.push({ id: 'fx-m3', title: 'Breakfast', time: '07:30', minutes: 15, category: 'meal', mealType: 'breakfast', waitingRecipes: ['Porridge'] })
    p.templates.push({ id: 'fx-meals', name: 'Meals', color: '#b07a4f', blocks, ...u })
  }
  if (since('9ebe280')) {
    // A reading block bound to a list, and one waiting for a list by name.
    p.templates.push({
      id: 'fx-reading', name: 'Reading', color: '#5e8f8a', ...u,
      blocks: [
        { id: 'fx-r1', title: 'Lesson', time: '20:00', minutes: 30, libraryListId: 'fx-list' },
        { id: 'fx-r2', title: 'Read', time: '21:00', minutes: 30, waitingLibrary: 'Evening shelf' },
      ],
    })
  }
  if (since('09836b8')) {
    ;(p.recipes ??= []).push(
      { id: 'fx-recipe', title: 'Lentil soup', text: 'Lentils, a carrot, an onion.\nSimmer for half an hour.', mealTypes: ['lunch', 'dinner'], kcal: 420, protein: 24, carbs: 60, fat: 8, servings: 4, minutes: 40, ...(since('d13a192') ? {} : { cooked: 2 }), ...u },
      { id: 'fx-recipe2', title: 'Bean bowl', text: 'Beans, rice, greens.', mealTypes: ['dinner'], ...u },
    )
  }

  p.library.push({
    id: 'fx-list', name: 'Courses', unit: 'lesson', unitPlural: 'lessons', unitShort: 'l', color: '#aa7744', ...u,
    items: [
      { id: 'fx-item', title: 'Drawing basics', total: 12, progress: 3, pace: 'two a week', link: 'https://example.com/course', ...(since('039e069') ? { author: 'A. Teacher' } : {}), ...u },
      { id: 'fx-item2', title: 'Knots', total: 5, progress: 5, finished: '2026-09-01', ...u },
    ],
  })
  p.backlog.push({ id: 'fx-later', title: 'Fix the shelf', category: 'fx-errands', minutes: 30, ...u })
  p.scratch.push({ id: 'fx-note', text: 'Buy stamps', createdAt: stamp, date: '2026-09-21', pinned: true, taskId: 'fx-t5', taskDate: '2026-09-21', ...u })

  const night: Loose = t({
    id: 'fx-t1', title: 'Night shift', time: '21:00', minutes: 600, category: 'core', core: true, highlight: true, fromTemplate: true,
    origin: { type: 'template', sourceId: 'fx-night', blockId: 'fx-n1' }, note: 'Badge and keys', templateNote: 'Badge and keys', noteExpanded: true,
  })
  if (since('37ea53f')) night.fromBlock = { title: 'Night shift', time: '21:00', minutes: 600, category: 'core' }
  p.days['2026-09-20'] = { date: '2026-09-20', autoApplied: true, ...u, tasks: [t({ id: 'fx-rep', title: 'Water the plants', time: '08:00', minutes: 10, repeat: 'daily', category: 'routine' })] }
  p.days['2026-09-21'] = {
    date: '2026-09-21', templateId: 'fx-night', dayType: 'night', sleepProfileId: 'fx-after-night', journal: 'A quiet shift.', lowDay: true,
    replannedOn: '2026-09-21', repeatSkips: ['fx-rep-old'], away: '14:00', autoApplied: true, ...u,
    tasks: [
      night,
      t({ id: 'fx-t2', title: 'Call the garage', done: true, time: '10:00', minutes: 15, actualMinutes: 20, link: 'https://example.com', pushCount: 2, latest: '12:00', category: 'fx-errands' }),
      t({ id: 'fx-t3', title: 'Sort the drawer', setAside: true, unbounded: true }),
      t({ id: 'fx-t4', title: 'Water the plants', time: '08:30', minutes: 10, repeatOf: 'fx-rep', origin: { type: 'repeat', sourceId: 'fx-rep' }, category: 'routine' }),
      t({ id: 'fx-t5', title: 'Buy stamps', fromNote: 'fx-note', origin: { type: 'manual' } }),
    ],
  }
  const next: Loose[] = [t({ id: 'fx-t6', title: 'Tidy the desk', time: '11:00', minutes: 20 })]
  if (since('a88173b')) {
    const walk: Loose = t({ id: 'fx-r1', title: 'Stretch', time: '17:00', minutes: 30, category: 'health', routineId: 'fx-routine', fromRoutine: { time: '17:00', minutes: 30 } })
    if (since('fda1cb8')) Object.assign(walk.fromRoutine, { title: 'Stretch', category: 'health' })
    if (since('db244a8')) walk.fromRoutine.core = true
    next.push(walk)
  }
  if (since('41d4e3e')) next.push(t({ id: 'fx-t7', title: 'Meal break', time: '01:00', minutes: 20, fromTemplate: true, nightOf: '2026-09-21', origin: { type: 'template', sourceId: 'fx-night', blockId: 'fx-n2' } }))
  if (since('4e02c1c')) {
    next.push(t({
      id: 'fx-t8', title: 'Dinner', time: '19:00', minutes: 30, category: 'meal', recipeId: 'fx-recipe', mealType: 'dinner', fromTemplate: true,
      origin: { type: 'template', sourceId: 'fx-meals', blockId: 'fx-m1' }, ...(since('37ea53f') ? { fromBlock: { title: 'Dinner', time: '19:00', minutes: 30, category: 'meal', recipeId: 'fx-recipe', mealType: 'dinner' } } : {}),
    }))
  }
  if (since('2c5f9c1')) next.push(t({ id: 'fx-t9', title: 'Commute', time: '07:30', minutes: 40, category: 'commute', missed: true }))
  p.days['2026-09-22'] = {
    date: '2026-09-22', autoApplied: true, ...u, tasks: next,
    ...(since('a88173b') ? { templateId: 'fx-rest', dayType: 'rest', routineSkips: ['fx-routine-old'] } : {}),
  }
}

test('the backup this version writes of the sample day and the overlay', () => {
  expect(STEP).toBeGreaterThanOrEqual(0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 16, 15, 0))
  localStorage.clear()
  const seed = readFileSync('scripts/sample-day.js', 'utf8')
  ;(0, eval)(seed)({})
  const base = JSON.parse(JSON.stringify(loadData()))
  expect(Object.keys(base.days).length).toBeGreaterThan(30)
  // Three days behind today rather than forty: the forty are the same shape
  // forty times, and a file per version is kept in the repo.
  for (const key of Object.keys(base.days)) if (key < '2026-09-13') delete base.days[key]
  overlay(base, new Date(2026, 8, 16, 14, 0).toISOString())
  localStorage.setItem('dienius:data', JSON.stringify(base))
  const data = loadData()
  // The version's own guard took the overlay whole, or it fell back to an
  // empty plan and this is not the file it would write.
  expect(data.templates.some((x: Loose) => x.id === 'fx-week')).toBe(true)
  expect((data.days['2026-09-21']?.tasks ?? []).map((x: Loose) => x.id)).toContain('fx-t1')
  if (since('a88173b')) expect(((data as Loose).routines ?? []).some((x: Loose) => x.id === 'fx-routine')).toBe(true)
  if (since('09836b8')) expect(((data as Loose).recipes ?? []).some((x: Loose) => x.id === 'fx-recipe')).toBe(true)
  writeFileSync(process.env.FIXTURE_OUT as string, exportJson(data))
})
