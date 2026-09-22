import { existsSync, readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, quickAdd, reopenAt, tick } from './app'

/**
 * A week of the owner's own roster, lived day by day - the overnight brief of
 * 2026-09-23, stage 3. The templates file lives outside the repo and only on
 * the owner's machine; this walk reads it where it is and is skipped
 * anywhere it is not (docs/OPEN-QUESTIONS.md). Every title it presses is
 * read out of the file at run time, so nothing here names what the file
 * says.
 *
 * What is walked: the file pasted and applied; each date of its roster
 * opened, its kind on it; on the first day a block ticked, one pushed to
 * tomorrow and one moved by hand; a day shift made a night by hand and made
 * a day again; the blocks that end by themselves done once their end has
 * passed and not before; the morning after a night, the night's shift done
 * on the night's own date; a night's meal walking its recipes by the night's
 * date; and at the end nothing gone and nothing doubled.
 */

const OWNERS_FILE = 'D:/Claude Code/Interactive_Journal/state/dienius-templates.json'

test.use({ timezoneId: 'Europe/Vilnius' })
test.skip(!existsSync(OWNERS_FILE), 'the owner\'s templates file is not on this machine')

interface Block {
  time?: string
  title: string
  minutes?: number
  ongoing?: boolean
  afterMidnight?: boolean
  mealType?: string
  recipes?: string[]
  category?: string
}
interface File {
  templates: { name: string; kind: string; blocks: Block[] }[]
  routines: { title: string; minutes: Record<string, number>; times: Record<string, string>; weekdays: number[] }[]
  roster: Record<string, string>
}

/** Vilnius, on a date of the roster, at an hour. */
const at = (date: string, hours: number, minutes = 0) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hours - 3, minutes))
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true }).click()

/** The plan as the browser holds it. */
function plan(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('dienius:data') || '{}') as {
    days: Record<string, { templateId?: string; tasks: { id: string; title: string; time?: string; done?: boolean; nightOf?: string; routineId?: string; recipeId?: string; origin?: { type: string; sourceId?: string; blockId?: string }; fromTemplate?: boolean }[] }>
    templates: { id: string; name: string; blocks: { id: string; title: string; recipeIds?: string[]; recipeId?: string; waitingRecipes?: string[] }[] }[]
    recipes: { id: string; title: string }[]
  })
}

/**
 * Opens a date on Today: the rail's month on a desktop, the arrows on a
 * phone. The Today tab always opens on today, so the arrows count from it.
 */
async function goTo(page: Page, today: string, to: string) {
  await tab(page, 'Today')
  const cell = page.locator(`.mini-calendar [data-date="${to}"]`)
  if (await cell.isVisible().catch(() => false)) {
    await cell.click()
    return
  }
  const days = Math.round((Date.parse(to) - Date.parse(today)) / 86_400_000)
  for (let i = 0; i < Math.abs(days); i++) await page.getByRole('button', { name: days > 0 ? 'Next day' : 'Previous day' }).click()
}

test('the owner\'s week: pasted, lived a day at a time, changed by hand in the middle, and whole at the end', async ({ page }, info) => {
  test.slow()
  const file = JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) as File
  const dates = Object.keys(file.roster).sort()
  const first = dates[0]
  const byLetter = Object.fromEntries(file.templates.map(t => [t.kind, t]))
  const dayLetter = Object.entries(byLetter).find(([, t]) => t.blocks.some(b => b.ongoing && !b.afterMidnight && (b.time ?? '') < '12:00'))?.[0] ?? 'D'
  const nightLetter = Object.entries(byLetter).find(([, t]) => t.blocks.some(b => b.afterMidnight))?.[0] ?? 'N'
  const dayKind = byLetter[dayLetter]
  const nightKind = byLetter[nightLetter]
  const shift = (t: typeof dayKind) => t.blocks.find(b => b.ongoing)!
  const phone = info.project.name === 'phone'

  // The file, pasted and applied on the first day of its roster.
  await openFreshAt(page, at(first, 7))
  await tab(page, 'Settings')
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(readFileSync(OWNERS_FILE, 'utf8'))
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.getByText(/^3 new templates\. 3 new routines\. 7 dates set/)).toBeVisible()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  // Every date of the roster, opened: its kind on it, and its blocks.
  let current = first
  for (const date of dates) {
    await goTo(page, first, date)
    current = date
    const letter = file.roster[date]
    await expect(page.locator('.day-template', { hasText: byLetter[letter].name }).first()).toBeVisible()
    const data = await plan(page)
    const own = data.days[date].tasks.filter(t => !t.nightOf && !t.routineId)
    expect(own.length, date).toBe(byLetter[letter].blocks.filter(b => !b.afterMidnight).length)
  }

  // The first day: a block ticked, one pushed to tomorrow, one moved by hand.
  await goTo(page, first, first)
  current = first
  const firstKind = byLetter[file.roster[first]]
  const [tickOne, moveOne] = firstKind.blocks.filter(b => !b.afterMidnight && b.time && !b.ongoing).slice(0, 2)
  // A block with a time is never pushed from its menu - it is placed or
  // un-anchored - so the thing pushed is a line written by hand, with no
  // time, the way a note to oneself is.
  const pushOne = { title: 'A line written by hand' }
  await quickAdd(page, pushOne.title)
  await tick(page, tickOne.title)
  // Quick-add gives the line the next free time; its menu takes the time
  // off, and then, a float, it can be pushed.
  await page.getByRole('button', { name: `More actions for ${pushOne.title}` }).first().click()
  await page.getByRole('button', { name: `Remove time from ${pushOne.title}` }).click()
  await page.getByRole('button', { name: `More actions for ${pushOne.title}` }).first().click()
  await page.getByRole('button', { name: `Push ${pushOne.title} to tomorrow` }).click()
  await page.getByRole('button', { name: `More actions for ${moveOne.title}` }).first().click()
  await page.getByRole('button', { name: /Details/ }).first().click()
  await page.getByRole('button', { name: '+5' }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  {
    const data = await plan(page)
    const today = data.days[first].tasks
    expect(today.find(t => t.title === tickOne.title)?.done).toBe(true)
    expect(today.find(t => t.title === pushOne.title)).toBeUndefined()
    expect(data.days[dates[1]].tasks.filter(t => t.title === pushOne.title)).toHaveLength(1)
    const [h, m] = moveOne.time!.split(':').map(Number)
    const later = `${String(Math.floor((h * 60 + m + 5) / 60)).padStart(2, '0')}:${String((m + 5) % 60).padStart(2, '0')}`
    expect(today.find(t => t.title === moveOne.title)?.time).toBe(later)
  }

  // A day shift made a night by hand in the middle of the week, and a day
  // again: the night's blocks only, then the day's only, nothing doubled.
  const aDay = dates.find(d => file.roster[d] === dayLetter)!
  await goTo(page, first, aDay)
  current = aDay
  async function stampByHand(name: string) {
    if (phone) {
      await tab(page, 'Calendar')
      await page.getByRole('button', { name: 'Month', exact: true }).click()
      const on = page.getByRole('button', { name: 'Roster', exact: true })
      if ((await on.getAttribute('aria-pressed')) === 'true') await on.click()
      await page.locator('.stamp-bar').getByRole('button', { name }).click()
      await page.locator(`[data-date="${aDay}"]`).click()
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await goTo(page, first, aDay)
    } else {
      await page.locator('.template-rail').getByRole('button', { name }).click()
      await page.getByRole('button', { name: 'Replace', exact: true }).click()
    }
  }
  await stampByHand(nightKind.name)
  {
    const data = await plan(page)
    const own = data.days[aDay].tasks.filter(t => !t.nightOf && !t.routineId && t.fromTemplate)
    expect(own.map(t => t.title).sort()).toEqual(nightKind.blocks.filter(b => !b.afterMidnight).map(b => b.title).sort())
    const next = dates[dates.indexOf(aDay) + 1]
    const carried = data.days[next].tasks.filter(t => t.nightOf === aDay)
    expect(carried.map(t => t.title).sort()).toEqual(nightKind.blocks.filter(b => b.afterMidnight).map(b => b.title).sort())
  }
  await stampByHand(dayKind.name)
  {
    const data = await plan(page)
    const own = data.days[aDay].tasks.filter(t => !t.nightOf && !t.routineId && t.fromTemplate)
    expect(own.map(t => t.title).sort()).toEqual(dayKind.blocks.filter(b => !b.afterMidnight).map(b => b.title).sort())
    const next = dates[dates.indexOf(aDay) + 1]
    expect(data.days[next].tasks.filter(t => t.nightOf === aDay)).toEqual([])
  }

  // The blocks that end by themselves: not before their end, done after it.
  const dayShift = shift(dayKind)
  const [sh, sm] = dayShift.time!.split(':').map(Number)
  const endMinutes = sh * 60 + sm + (dayShift.minutes ?? 0)
  const beforeEnd = endMinutes - 1
  await reopenAt(page, at(aDay, Math.floor(beforeEnd / 60), beforeEnd % 60))
  await goTo(page, aDay, aDay)
  expect((await plan(page)).days[aDay].tasks.find(t => t.title === dayShift.title && t.fromTemplate)?.done).toBeFalsy()
  await reopenAt(page, at(aDay, Math.floor((endMinutes + 1) / 60), (endMinutes + 1) % 60))
  await goTo(page, aDay, aDay)
  expect((await plan(page)).days[aDay].tasks.find(t => t.title === dayShift.title && t.fromTemplate)?.done).toBe(true)

  // The morning after a night: the night's shift done on the night's own
  // date, and the next date's own shift not.
  const nights = dates.filter(d => file.roster[d] === nightLetter)
  const night = nights[0]
  const morning = dates[dates.indexOf(night) + 1] ?? dates[dates.length - 1]
  const nightShift = shift(nightKind)
  await reopenAt(page, at(morning, 8))
  await goTo(page, morning, night)
  {
    const data = await plan(page)
    expect(data.days[night].tasks.find(t => t.title === nightShift.title && t.fromTemplate)?.done).toBe(true)
    if (file.roster[morning] === nightLetter) {
      expect(data.days[morning].tasks.find(t => t.title === nightShift.title && t.fromTemplate && !t.nightOf)?.done).toBeFalsy()
    }
  }

  // A night's meal walks its recipes by the night's date: with the recipes
  // in Kitchen, two nights in a row take two different ones from the block.
  const meal = nightKind.blocks.find(b => b.afterMidnight && (b.recipes?.length ?? 0) > 1)
  if (meal && nights.length > 1) {
    await tab(page, 'Kitchen')
    await page.getByRole('button', { name: 'Paste many' }).click()
    const text = meal.recipes!.map(name => `NAME: ${name}\n300 kcal\nINGREDIENTS\nsomething\nSTEPS\nCook it.`).join('\n')
    await page.getByRole('textbox', { name: 'Recipes' }).fill(text)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    // Each morning after a night, opened, takes its night's recipe.
    const mornings = nights.slice(0, 2).map(n => dates[dates.indexOf(n) + 1] ?? null).filter((d): d is string => !!d && d in file.roster)
    const taken: string[] = []
    let from = night
    for (const m of mornings) {
      await goTo(page, morning, m)
      from = m
      const data = await plan(page)
      const task = data.days[m].tasks.find(t => t.nightOf && t.title === meal.title)!
      expect(task.recipeId, m).toBeTruthy()
      taken.push(data.recipes.find(r => r.id === task.recipeId)!.title)
    }
    for (const title of taken) expect(meal.recipes).toContain(title)
    if (taken.length === 2) expect(taken[0]).not.toBe(taken[1])
    current = from
  }

  // Nothing gone, nothing doubled: each date holds its kind's blocks once,
  // plus what the week put there by hand.
  const data = await plan(page)
  for (const date of dates) {
    const own = data.days[date].tasks.filter(t => t.fromTemplate && !t.nightOf)
    const titles = own.map(t => t.title)
    expect(new Set(titles).size, `${date} doubled`).toBe(titles.length)
    const expected = byLetter[file.roster[date]].blocks.filter(b => !b.afterMidnight).map(b => b.title)
    const missing = expected.filter(t => !titles.includes(t))
    expect(missing, `${date} missing`).toEqual([])
    const carried = data.days[date].tasks.filter(t => t.nightOf)
    const carriedTitles = carried.map(t => `${t.nightOf}:${t.title}`)
    expect(new Set(carriedTitles).size, `${date} night doubled`).toBe(carriedTitles.length)
  }
})
