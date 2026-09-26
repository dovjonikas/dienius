import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { openFreshAt, reopenAt, tick } from './app'

/**
 * The owner's first week under the freeze, lived the evening before it - the
 * last work before the freeze of 2026-09-28. Four dates of the owner's own
 * roster, opened on a 375px phone and on a desktop the way the owner will
 * open them: the last free day before the nights, the first night, the night
 * after a night, and the day after the nights. The templates file is read
 * where it lives (owners-file.local, git-ignored) and the walk is skipped
 * anywhere it is not (DECISIONS "Four questions answered before the
 * freeze"); every title pressed is read out of the file at run time, and
 * every recipe and book here is invented.
 *
 * What is held, each in a test of its own: each date's blocks, the night's
 * hours on the morning after, the gym at the kind's own time, the sleep the
 * date wakes from and the reading block naming the list's book; the close
 * card at each kind's own time, closing that date and never while its shift
 * runs; a meal block that carries a kind of meal and no recipes choosing
 * among Kitchen's recipes of that meal, with their numbers, and keeping the
 * choice; the next meal on the first screen; and the app opened at half
 * past two in the first night.
 */

/** Where the file is: a line in owners-file.local at the repo's root, which git ignores, or the environment. Never written here. */
function ownersFilePath(): string | undefined {
  const fromEnv = process.env.DIENIUS_OWNERS_FILE
  if (fromEnv) return fromEnv
  const pointer = fileURLToPath(new URL('../owners-file.local', import.meta.url))
  return existsSync(pointer) ? readFileSync(pointer, 'utf8').trim() : undefined
}

const OWNERS_FILE = ownersFilePath() ?? ''

test.use({ timezoneId: 'Europe/Vilnius' })
test.skip(!existsSync(OWNERS_FILE), "the owner's templates file is not on this machine")

interface Block {
  time?: string
  title: string
  minutes?: number
  ongoing?: boolean
  afterMidnight?: boolean
  mealType?: string
  recipes?: string[]
  library?: string
}
interface Kind {
  name: string
  kind: string
  type: string
  afterNight?: string
  sleep?: { from: string; to: string }
  blocks: Block[]
}
interface Routine {
  title: string
  minutes: number | Record<string, number>
  times: Record<string, string>
  weekdays: number[]
}
interface File {
  templates: Kind[]
  routines?: Routine[]
  roster: Record<string, string>
}

/** The book every reading block of the file names here - invented; the owner's own shelf stays in their Library. */
const BOOK = 'A first book'
const OTHER_BOOK = 'A second book'

/**
 * A recipe's name opens with its meal and a colon, the way the app's starting
 * map of meal words reads it (lib/mealWords.ts): the meal's own name says
 * that meal, and "Lunch" says lunch and dinner both.
 */
const MEAL_WORDS: Record<string, string[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch', 'dinner'],
  dinner: ['dinner'],
  'pre-gym': ['pre-gym'],
  'post-gym': ['post-gym'],
  snack: ['snack'],
}
const wordFor = (meal: string) => meal[0].toUpperCase() + meal.slice(1)

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** Sunday is 0, as the app counts weekdays; the file writes it as 7. */
const weekdayOf = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay()

/** Vilnius, on a date, at an hour - past 24 the date after. */
const at = (date: string, hours: number, mins = 0) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hours - 3, mins))
}
const atMinutes = (date: string, m: number) => at(date, Math.floor(m / 60), m % 60)

/**
 * The kind each date of a roster is read as: a date after a night is the
 * kind its own kind's afterNight names (`resolveAfterNight` in the app),
 * worked out from the file alone.
 */
function kindsAsRead(file: File): Record<string, Kind> {
  const byLetter = new Map(file.templates.map(t => [t.kind, t]))
  const read: Record<string, Kind> = {}
  for (const date of Object.keys(file.roster).sort()) {
    const written = byLetter.get(file.roster[date])!
    const afterNight = read[addDays(date, -1)]?.type === 'night' && written.afterNight !== written.kind ? byLetter.get(written.afterNight ?? '') : undefined
    read[date] = afterNight ?? written
  }
  return read
}

interface Week {
  file: File
  /** The text pasted: the file, its roster naming the day after the nights where the file did not. */
  text: string
  read: Record<string, Kind>
  /** The last free day before the first night, the first night, the night after it, and the day after the nights. */
  dates: string[]
  /** Whether the day after the nights was added to the roster here. */
  addedAfter: boolean
  /** The recipes pasted into Kitchen, by name, with the meals each is for. */
  recipes: { name: string; meals: string[]; kcal: number; protein: number }[]
  listName: string
}

/**
 * The week, read out of the file: the first run of nights in its roster,
 * the free day before it and the day after it. The roster is written as far
 * as the owner's journal has written it; where it stops at the last night,
 * the day after is added here as the free kind, which the file's own
 * afterNight reads as the day after nights - so the walk can live it, and
 * docs/OPEN-QUESTIONS.md says the roster should name it before the day.
 */
function weekOf(file: File): Week {
  const read = kindsAsRead(file)
  const dates = Object.keys(file.roster).sort()
  const firstNight = dates.find((d, i) => read[d].type === 'night' && (i === 0 || read[dates[i - 1]].type !== 'night'))
  if (!firstNight) throw new Error('the roster has no night')
  const free = addDays(firstNight, -1)
  if (!read[free] || read[free].type === 'night') throw new Error('the roster has no free day before its first night')
  let lastNight = firstNight
  while (read[addDays(lastNight, 1)]?.type === 'night') lastNight = addDays(lastNight, 1)
  const after = addDays(lastNight, 1)
  const roster = { ...file.roster }
  let addedAfter = false
  if (!(after in roster)) {
    const byLetter = new Map(file.templates.map(t => [t.kind, t]))
    const freeKind = file.templates.find(t => t.type !== 'night' && t.afterNight && byLetter.get(t.afterNight)?.type === 'rest')
    if (!freeKind) throw new Error('the file has no free day naming the day after nights')
    roster[after] = freeKind.kind
    addedAfter = true
  }
  const full = { ...file, roster }
  const meals = [...new Set(file.templates.flatMap(t => t.blocks.map(b => b.mealType)).filter((m): m is string => !!m))]
  const recipes = meals.flatMap((meal, i) => [
    { name: `${wordFor(meal)}: a first dish`, meals: MEAL_WORDS[meal] ?? [meal], kcal: 300 + i * 10, protein: 20 + i },
    { name: `${wordFor(meal)}: a second dish`, meals: MEAL_WORDS[meal] ?? [meal], kcal: 400 + i * 10, protein: 30 + i },
  ])
  const listName = file.templates.flatMap(t => t.blocks).find(b => b.library)?.library ?? 'MAIN'
  return { file, text: JSON.stringify(full), read: kindsAsRead(full), dates: [free, firstNight, ...(lastNight === firstNight ? [] : [addDays(firstNight, 1)]), after].slice(0, 4), addedAfter, recipes, listName }
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true })

/** The plan as the browser holds it. */
function plan(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dienius:data') || '{}') as {
    days: Record<string, { templateId?: string; tasks: { id: string; title: string; time?: string; minutes?: number; done?: boolean; nightOf?: string; routineId?: string; recipeId?: string; fromTemplate?: boolean; libraryRef?: unknown }[] }>
    routines: { id: string; title: string }[]
    recipes: { id: string; title: string }[]
    settings: { sleepProfiles: { id: string; window: { start: string; end: string } }[] }
  })
}

const card = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: title, exact: true }) })

/**
 * Every mark on every meta line keeps its word: the time, the night's mark,
 * the category, core, the note, a book's chapter, the length. On a 375px
 * phone a night's card carries all of them, and the line takes a second row
 * rather than cutting each to a letter and dots. Only a box that hides its
 * overflow can cut a word, so that is what is asked.
 */
async function noMetaCut(page: Page, what: string) {
  const cut = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.task-list > li .task-meta > *')]
      .filter(el => getComputedStyle(el).overflow !== 'visible' && el.offsetWidth > 1 && el.scrollWidth > el.clientWidth + 1)
      .map(el => el.textContent?.trim()),
  )
  expect(cut, `${what}: no mark on a meta line is cut short`).toEqual([])
}

/** The kind's own blocks as the date holds them: the reading block is its book. */
const ownTitles = (kind: Kind) => kind.blocks.filter(b => !b.afterMidnight).map(b => (b.library ? BOOK : b.title)).sort()

/**
 * The evening before the week: a shelf into the Library under the list the
 * file's reading blocks name, two recipes of every meal the file's blocks
 * are for into Kitchen, and the file into Settings.
 */
async function setUp(page: Page, phone: boolean): Promise<Week> {
  const week = weekOf(JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) as File)
  await openFreshAt(page, at(addDays(week.dates[0], -1), 20))
  if (phone) await page.setViewportSize({ width: 375, height: 812 })

  await tab(page, 'Library').click()
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Books' }).fill([week.listName, `${BOOK} - An author`, `${OTHER_BOOK} - Another author`].join('\n'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: new RegExp(`^${BOOK}, `) })).toBeVisible()

  await tab(page, 'Kitchen').click()
  await page.getByRole('button', { name: 'Paste many' }).click()
  const text = week.recipes.map(r => `NAME: ${r.name}\n${r.kcal} kcal\n${r.protein} g protein\nINGREDIENTS\nsomething\nSTEPS\nCook it.`).join('\n')
  await page.getByRole('textbox', { name: 'Recipes' }).fill(text)
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await tab(page, 'Settings').click()
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(week.text)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()
  return week
}

/** Today, opened at a moment, on its page. */
async function openTodayAt(page: Page, time: Date) {
  await reopenAt(page, time)
  await tab(page, 'Today').click()
}

/**
 * The sleep bands on the grid, in minutes of the date's clock, read off the
 * hour marks and the half-hour rules that share an edge with each band -
 * never by multiplying pixels, since the grid's scale is not proportional.
 * An edge that meets no mark reads as null.
 */
async function sleepBands(page: Page, phone: boolean): Promise<{ start: number | null; end: number | null }[]> {
  if (phone) {
    const show = page.getByRole('button', { name: 'Show timeline' })
    if (await show.isVisible().catch(() => false)) await show.click()
  }
  await expect(page.locator('.timeline-sleep-band').first()).toBeAttached()
  return page.evaluate(() => {
    const top = (el: Element) => parseFloat((el as HTMLElement).style.top)
    const marks = [...document.querySelectorAll<HTMLElement>('.timeline-hour[data-minutes]')].map(el => ({ m: Number(el.dataset.minutes), top: top(el) })).sort((a, b) => a.top - b.top)
    const halves = [...document.querySelectorAll('.timeline-half-hour-rule')].map(el => {
      // The half hour after the nearest mark above it - the earliest of the marks at that pixel,
      // since a stretch drawn at no height stacks its marks and its half rule on one pixel.
      const above = marks.filter(mark => mark.top <= top(el) + 0.5)
      const nearest = Math.max(...above.map(mark => mark.top))
      const earliest = Math.min(...above.filter(mark => mark.top === nearest).map(mark => mark.m))
      return { m: above.length ? earliest + 30 : Number.NaN, top: top(el) }
    })
    const points = [...marks, ...halves]
    // Where the grid spends no pixels on a stretch - a desktop day fitted to
    // its window draws the hour before waking at nothing - several marks
    // share one pixel: a band's start is the earliest of them, its end the latest.
    const at = (px: number) => points.filter(p => Math.abs(p.top - px) < 1.5).map(p => p.m)
    const first = (px: number) => (at(px).length ? Math.min(...at(px)) : null)
    const last = (px: number) => (at(px).length ? Math.max(...at(px)) : null)
    return [...document.querySelectorAll<HTMLElement>('.timeline-sleep-band')].map(el => ({
      start: first(parseFloat(el.style.top)),
      end: last(parseFloat(el.style.top) + parseFloat(el.style.height)),
    }))
  })
}

test('each date holds its kind: its blocks, the night before on its morning, the gym at its time, the sleep it wakes from, and the book on its reading block', async ({ page }, info) => {
  test.slow()
  const phone = info.project.name === 'phone'
  const week = await setUp(page, phone)
  const byLetter = new Map(week.file.templates.map(t => [t.kind, t]))
  const routineIds = new Map<string, string>()

  for (const date of week.dates) {
    const kind = week.read[date]
    const wake = minutes(kind.sleep!.to)
    await openTodayAt(page, atMinutes(date, wake))
    const what = `${date} (${kind.kind})`

    // The day says which kind it is.
    await expect(page.locator('.day-template', { hasText: kind.name }).first(), what).toBeVisible()

    const data = await plan(page)
    const tasks = data.days[date].tasks
    // Its own blocks, once each; the reading block by its book.
    expect(tasks.filter(t => t.fromTemplate && !t.nightOf && !t.routineId).map(t => t.title).sort(), `${what} own blocks`).toEqual(ownTitles(kind))
    if (kind.blocks.some(b => b.library)) {
      await expect(page.getByRole('checkbox', { name: BOOK, exact: true }), `${what} reads its book`).toBeAttached()
      expect(tasks.filter(t => t.libraryRef).map(t => t.title), `${what} reads from the list`).toEqual([BOOK])
    }
    // The night before, on this morning: its hours after midnight, once each.
    const before = week.read[addDays(date, -1)]
    const carried = tasks.filter(t => t.nightOf === addDays(date, -1)).map(t => t.title).sort()
    expect(carried, `${what} the night before`).toEqual(before?.type === 'night' ? before.blocks.filter(b => b.afterMidnight).map(b => b.title).sort() : [])
    // The gym of this weekday at this kind's time and length, and none on a Sunday.
    const weekday = weekdayOf(date)
    const due = (week.file.routines ?? []).filter(r => r.weekdays.map(d => (d === 7 ? 0 : d)).includes(weekday))
    const there = tasks.filter(t => t.routineId)
    expect(there.map(t => t.title).sort(), `${what} routines`).toEqual(due.map(r => r.title).sort())
    for (const routine of due) {
      const task = there.find(t => t.title === routine.title)!
      const length = typeof routine.minutes === 'number' ? routine.minutes : routine.minutes[kind.kind]
      expect({ time: task.time, minutes: task.minutes }, `${what} ${routine.title}`).toEqual({ time: routine.times[kind.kind], minutes: length })
      routineIds.set(routine.title, task.routineId!)
    }
    if (weekday === 0) expect(there, `${what} is a Sunday`).toEqual([])
    await noMetaCut(page, what)
    // The grey band the day wakes from ends at this kind's waking hour.
    const bands = await sleepBands(page, phone)
    expect(bands.length, `${what} draws its sleep`).toBeGreaterThan(0)
    expect(bands[0].end, `${what} wakes at ${kind.sleep!.to}`).toBe(wake)
    // Where tonight's band is on the grid, it starts at the bedtime the next date's kind sets.
    const next = week.read[addDays(date, 1)]
    if (bands.length > 1 && next?.sleep) {
      const bed = minutes(next.sleep.from) < minutes(next.sleep.to) ? minutes(next.sleep.from) + 1440 : minutes(next.sleep.from)
      expect(bands[bands.length - 1].start, `${what} sleeps at ${next.sleep.from}`).toBe(bed)
    }
    info.annotations.push({ type: what, description: JSON.stringify({ bands, own: tasks.length, byLetter: byLetter.size }) })
  }
})

test('the close card comes half an hour before the sleep that ends each date - a night the morning after - closes that date, and never comes while its shift runs', async ({ page }, info) => {
  test.slow()
  const phone = info.project.name === 'phone'
  const week = await setUp(page, phone)
  const closeCard = () => page.getByLabel('Closing the day')
  const dismissed = () => page.evaluate(() => localStorage.getItem('dienius:evening-dismissed'))

  for (const date of week.dates) {
    const kind = week.read[date]
    const next = week.read[addDays(date, 1)]
    const what = `${date} (${kind.kind})`
    // The sleep that ends this date is the next date's; where the roster ends, the app keeps the first
    // schedule in Settings as tonight's, so the card follows that bedtime (lib/shiftDay.ts, sleepOn).
    let bed: number
    if (next?.sleep) bed = minutes(next.sleep.from) < minutes(next.sleep.to) ? minutes(next.sleep.from) + 1440 : minutes(next.sleep.from)
    else {
      const { start, end } = (await plan(page)).settings.sleepProfiles[0].window
      bed = minutes(start) < minutes(end) ? minutes(start) + 1440 : minutes(start)
    }
    const due = bed - 30

    // Never while the shift runs: a minute in, and a minute before it ends.
    for (const shift of kind.blocks.filter(b => b.ongoing && b.time && b.minutes)) {
      const start = minutes(shift.time!) + (shift.afterMidnight ? 1440 : 0)
      for (const moment of [start + 1, start + shift.minutes! - 1]) {
        await openTodayAt(page, atMinutes(date, moment))
        await expect(closeCard(), `${what} ${shift.title} running at ${clock(moment)}`).toHaveCount(0)
      }
    }
    // Not at the time in Settings, which is only for a date with no kind.
    if (due !== 21 * 60 + 30) {
      await openTodayAt(page, atMinutes(date, 21 * 60 + 30))
      await expect(closeCard(), `${what} at half past nine`).toHaveCount(0)
    }
    // A minute early, nothing; at its time, the card for this date.
    await openTodayAt(page, atMinutes(date, due - 1))
    await expect(closeCard(), `${what} a minute early`).toHaveCount(0)
    await openTodayAt(page, atMinutes(date, due))
    const heading = kind.type === 'night' ? 'That was the night' : due >= 1440 ? 'That was the day' : 'That was today'
    await expect(closeCard(), `${what} at ${clock(due)}`).toContainText(heading)
    await closeCard().getByRole('button', { name: 'Close the day' }).click()
    await expect(closeCard()).toHaveCount(0)
    expect(await dismissed(), `${what} is the date closed`).toBe(date)
    info.annotations.push({ type: what, description: `closes at ${clock(due)}${due >= 1440 ? ' the day after' : ''}` })
  }
})

test('a meal block with a kind of meal and no recipes: choose opens every recipe of that meal with its kcal and protein, one press puts one on, and it stays', async ({ page }, info) => {
  test.slow()
  const phone = info.project.name === 'phone'
  const week = await setUp(page, phone)
  const chosen: Record<string, string> = {}

  const choose = async (date: string, block: Block, moment: Date) => {
    const meal = card(page, block.title)
    const choices = () => meal.getByRole('list', { name: `Recipes for ${block.title}` })
    await meal.getByRole('button', { name: `Choose a recipe for ${block.title}` }).click()
    const expected = week.recipes.filter(r => r.meals.includes(block.mealType!))
    const buttons = choices().getByRole('button')
    await expect(buttons, `${date} ${block.title}: every recipe of its meal`).toHaveCount(expected.length)
    const names = (await buttons.allTextContents()).map(t => t.trim())
    for (const recipe of expected) {
      expect(names.some(n => n.startsWith(recipe.name) && n.includes(`${recipe.kcal} kcal · ${recipe.protein} g protein`)), `${date} ${block.title}: ${recipe.name} with its numbers`).toBe(true)
    }
    const pick = expected[0]
    await choices().getByRole('button', { name: new RegExp(`^${pick.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click()
    await expect(meal.getByRole('button', { name: `Recipe: ${pick.name}` }), `${date} ${block.title}: on the meal`).toBeVisible()
    chosen[`${date}:${block.title}`] = pick.name
    // Opened again later, still on it.
    await openTodayAt(page, moment)
    await expect(card(page, block.title).getByRole('button', { name: `Recipe: ${pick.name}` }), `${date} ${block.title}: kept`).toBeVisible()
    const data = await plan(page)
    const task = data.days[date].tasks.find(t => t.title === block.title)!
    expect(data.recipes.find(r => r.id === task.recipeId)?.title, `${date} ${block.title}: in the plan`).toBe(pick.name)
  }

  // The free day: every one of its meals, each a kind of meal and no recipes.
  const free = week.dates[0]
  const freeKind = week.read[free]
  const moment = atMinutes(free, minutes(freeKind.sleep!.to))
  await openTodayAt(page, moment)
  const meals = freeKind.blocks.filter(b => b.mealType && !(b.recipes?.length))
  expect(meals.length, 'the free day has meals with a kind of meal and no recipes').toBeGreaterThan(0)
  for (const block of meals) await choose(free, block, moment)

  // And the night's own meal after midnight, on the morning's page, where it is running.
  const night = week.dates[1]
  const snack = week.read[night].blocks.find(b => b.afterMidnight && b.mealType && !(b.recipes?.length))
  if (snack) {
    const morning = addDays(night, 1)
    const moment = atMinutes(morning, minutes(snack.time!))
    await openTodayAt(page, moment)
    await choose(morning, snack, moment)
  }
  info.annotations.push({ type: 'chosen', description: JSON.stringify(chosen) })
})

/**
 * Where the next meal stands as the app opens. It is the first card, or the
 * one right after the running card, on every kind; on a desktop its whole
 * card is on the first screen. On a 375px phone the first screen ends where
 * the bar begins, and at waking on the owner's own kinds the running card is
 * all that stands above it - the day's tools, the morning's notice and the
 * sleep the day follows take the rest - so the meal's name is held on the
 * first screen only where it is the first card, the night's own meal on the
 * morning after; the rest is measured and written to the report (BACKLOG,
 * Parked: the next meal on the phone's first screen).
 */
test('the next meal is the first card or the one after the running card as each date wakes and in the night, and on the first screen where the page has the room', async ({ page }, info) => {
  test.slow()
  const phone = info.project.name === 'phone'
  const week = await setUp(page, phone)

  const nextMeal = async (title: string, what: string) => {
    const meal = card(page, title)
    await expect(meal, what).toBeAttached()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.evaluate(() => document.fonts.ready)
    const titles = await page.locator('.task-list > li input[type=checkbox]').evaluateAll(els => els.map(el => el.getAttribute('aria-label')))
    const index = titles.indexOf(title)
    expect(index, `${what}: ${title} at the top of the list`).toBeLessThanOrEqual(1)
    // The first screen: to the phone's bar, which stands over the page, and to the window's foot on a desktop.
    const bar = phone ? await page.getByRole('navigation', { name: 'Views' }).boundingBox() : null
    const fold = bar ? bar.y : page.viewportSize()!.height
    const box = (await meal.boundingBox())!
    const name = (await meal.locator('.task-check').boundingBox())!
    info.annotations.push({ type: what, description: `${title} is card ${index + 1}, ${Math.round(box.y)} to ${Math.round(box.y + box.height)}, its name to ${Math.round(name.y + name.height)}; the first screen ends at ${Math.round(fold)}` })
    if (!phone) expect(box.y + box.height, `${what}: ${title} on the first screen`).toBeLessThanOrEqual(fold)
    else if (index === 0) expect(name.y + name.height, `${what}: the name of ${title} on the first screen`).toBeLessThanOrEqual(fold)
  }

  for (const date of week.dates) {
    const kind = week.read[date]
    const wake = minutes(kind.sleep!.to)
    // The night before's meals after midnight, each opened as it comes - the
    // first of them the meal the app is opened for at half past two - and
    // ticked, the way a snack that was eaten is; a block that ends by itself
    // needs no tick. Unticked, they would stand above the morning's own list.
    const before = week.read[addDays(date, -1)]
    const nightMeals = before?.type === 'night' ? before.blocks.filter(b => b.afterMidnight && b.mealType && b.time).sort((a, b) => minutes(a.time!) - minutes(b.time!)) : []
    for (const [i, meal] of nightMeals.entries()) {
      await openTodayAt(page, atMinutes(date, minutes(meal.time!)))
      if (i === 0) await nextMeal(meal.title, `${addDays(date, -1)} (${before!.kind}) at ${meal.time}`)
      await tick(page, meal.title)
      await expect(page.getByRole('checkbox', { name: meal.title, exact: true })).toBeChecked()
    }
    await openTodayAt(page, atMinutes(date, wake))
    const next = kind.blocks.filter(b => !b.afterMidnight && b.mealType && b.time && minutes(b.time) >= wake).sort((a, b) => minutes(a.time!) - minutes(b.time!))[0]
    await nextMeal(next.title, `${date} (${kind.kind}) at ${kind.sleep!.to}`)
  }
})

test('opened at half past two in the first night, today is the night\'s morning: its hours after midnight, its shift still running, and the night after it on the same page', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  const week = await setUp(page, phone)
  const night = week.dates[1]
  const morning = addDays(night, 1)
  const kind = week.read[night]
  await openTodayAt(page, at(morning, 2, 30))
  for (const block of kind.blocks.filter(b => b.afterMidnight)) {
    await expect(page.getByRole('checkbox', { name: block.title, exact: true }), `${block.title} on the morning`).toBeAttached()
  }
  const data = await plan(page)
  const shift = kind.blocks.find(b => b.ongoing)!
  expect(data.days[night].tasks.find(t => t.title === shift.title && t.fromTemplate)?.done, 'the shift still runs').toBeFalsy()
  // The morning's own kind - the night after a night - stands on the page with its blocks.
  const own = week.read[morning]
  await expect(page.locator('.day-template', { hasText: own.name }).first()).toBeVisible()
  expect(data.days[morning].tasks.filter(t => t.fromTemplate && !t.nightOf && !t.routineId).map(t => t.title).sort()).toEqual(ownTitles(own))
  // What is running now is said on the first screen.
  const running = kind.blocks.filter(b => b.afterMidnight && b.time && minutes(b.time) <= 150).sort((a, b) => minutes(b.time!) - minutes(a.time!))[0]
  if (running) await expect(page.getByText(running.title).filter({ visible: true }).first()).toBeVisible()
  await noMetaCut(page, `${morning} at 02:30`)
})

test('the date after the nights, which the roster does not name yet, holds the night\'s hours and no kind of its own', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  const file = JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) as File
  const week = weekOf(file)
  test.skip(!week.addedAfter, 'the roster names the day after the nights')
  const after = week.dates[week.dates.length - 1]
  await openFreshAt(page, at(addDays(week.dates[0], -1), 20))
  if (phone) await page.setViewportSize({ width: 375, height: 812 })
  await tab(page, 'Settings').click()
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(readFileSync(OWNERS_FILE, 'utf8'))
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()
  await openTodayAt(page, at(after, 13))
  const data = await plan(page)
  const tasks = data.days[after]?.tasks ?? []
  expect(tasks.filter(t => !t.nightOf), `${after} has nothing of its own`).toEqual([])
  expect(tasks.filter(t => t.nightOf).length, `${after} has the night before`).toBeGreaterThan(0)
  await expect(page.locator('.day-template')).toHaveCount(0)
})
