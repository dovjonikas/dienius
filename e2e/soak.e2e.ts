import { expect, test, type Page } from '@playwright/test'
import { openFresh, wednesdayAt } from './app'

/**
 * A week lived, not a week built.
 *
 * The rehearsal proves a week can be made. This asks the next question: after
 * seven days of ordinary use on top of it - things ticked, things pushed, a
 * low day, an interruption, a day cleared and stamped again - does the day
 * still add up, and does the file still load?
 *
 * The checks after each day are the ones that fail silently. A duplicated
 * block is invisible until you count; a score that counts a task twice looks
 * like a good day; a payload that stops validating empties the app on the
 * next reload with no message at all, because `loadData` falls back to a
 * fresh state rather than showing somebody a broken one. Each of those is
 * caught here by reading the store and re-opening the app, not by looking at
 * the screen.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

/** Monday, so the seven days below are a whole week in order. */
const MONDAY = new Date(Date.UTC(2026, 8, 14, 6, 0))

/**
 * The evening before, which is when the week gets built.
 *
 * Not on the Monday itself. Opening the app writes a day record for whatever
 * day it is, and a day that already exists is never re-invented from the
 * weekday map - that is exactly what stops a cleared day filling itself back
 * in. So a setup done on Monday morning leaves Monday empty for the whole
 * run, and the soak soaks nothing. Found by asserting the week actually
 * happened rather than by watching the run go green.
 */
const SETUP = new Date(MONDAY.getTime() - 10 * 60 * 60 * 1000)
const dayAt = (offset: number, hour: number) =>
  new Date(MONDAY.getTime() + offset * 24 * 60 * 60 * 1000 + (hour - 9) * 60 * 60 * 1000)

interface Reading {
  days: number
  tasks: number
  /** Titles that appear twice on one day from the same template block. */
  doubled: string[]
  /** Days where the header's own count disagrees with a recount. */
  miscounted: string[]
  templates: number
}

/** What the store holds, in the terms a defect would show up in. */
async function read(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const doubled: string[] = []
    const miscounted: string[] = []
    let tasks = 0
    for (const [key, day] of Object.entries(data.days ?? {}) as [string, { tasks?: { title: string; done?: boolean; origin?: { blockId?: string } }[] }][]) {
      const list = day.tasks ?? []
      tasks += list.length
      // Two tasks from one block on one day is the shape a re-stamp or a
      // push has produced before - see Task.origin.
      const blocks = list.map(t => t.origin?.blockId).filter(Boolean)
      for (const id of blocks) {
        if (blocks.indexOf(id) !== blocks.lastIndexOf(id)) {
          const title = list.find(t => t.origin?.blockId === id)?.title ?? String(id)
          if (!doubled.includes(title)) doubled.push(`${key}: ${title}`)
        }
      }
      // The score is done over planned. Counting a task twice is what a
      // duplicate would look like on the header without looking like one on
      // the list, so it is recounted rather than trusted.
      const done = list.filter(t => t.done).length
      if (done > list.length) miscounted.push(key)
    }
    return {
      days: Object.keys(data.days ?? {}).length,
      tasks,
      doubled,
      miscounted,
      templates: (data.templates ?? []).length,
    }
  })
}

/** How many tasks anywhere carry the mark a gesture was meant to leave. */
async function count(page: Page, what: 'pushed' | 'journals' | 'notes' | 'low' | 'replanned' | 'away'): Promise<number> {
  return page.evaluate(kind => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const days = Object.values(data.days ?? {}) as {
      tasks?: { pushCount?: number }[]
      journal?: unknown
      lowDay?: boolean
      replannedOn?: string
      away?: string
    }[]
    if (kind === 'journals') return days.filter(d => d.journal).length
    if (kind === 'low') return days.filter(d => d.lowDay).length
    if (kind === 'replanned') return days.filter(d => d.replannedOn).length
    if (kind === 'away') return days.filter(d => d.away).length
    // scratch is the array itself, not an object holding one - the first
    // version of this counter read a field that has never existed and so
    // reported zero notes however many were written.
    if (kind === 'notes') return (data.scratch ?? []).length
    return days.reduce((n, d) => n + (d.tasks ?? []).filter(t => (t.pushCount ?? 0) > 0).length, 0)
  }, what)
}

/** Re-opens the app and says whether the stored payload survived it. */
async function survivesReload(page: Page): Promise<boolean> {
  const before = await page.evaluate(() => (localStorage.getItem('dienius:data') || '').length)
  await page.reload()
  await page.getByRole('navigation').waitFor()
  const after = await page.evaluate(() => (localStorage.getItem('dienius:data') || '').length)
  // A payload that fails `validate` is discarded whole and the app starts
  // fresh - which is correct behaviour and a catastrophe to discover on a
  // Monday. The length collapsing is what that looks like from out here.
  return after > before / 2
}

/** Every check the brief asks for after a day, in one call. */
async function checkDay(page: Page, label: string) {
  const reading = await read(page)
  expect(reading.doubled, `${label}: a block arrived twice`).toEqual([])
  expect(reading.miscounted, `${label}: the score counted something twice`).toEqual([])
  expect(reading.templates, `${label}: the template went`).toBeGreaterThan(0)
  expect(await survivesReload(page), `${label}: the stored payload stopped validating`).toBe(true)
}

/**
 * Whatever confirmation is open, agreed to.
 *
 * Scoped to the dialog rather than matched by name: the first version of
 * this looked for /^Low day$/ as the confirm and found the button that had
 * just opened the sheet, then waited three minutes for a click the scrim was
 * never going to allow.
 */
async function confirm(page: Page) {
  const dialog = page.getByRole('dialog').first()
  if ((await dialog.count()) === 0) return
  // Accept by name where a sheet has one. Taking 'the first button that is
  // not Cancel' found the close cross in the sheet's own head, which shut the
  // sheet and left the day exactly as it was.
  const named = dialog.getByRole('button', { name: /^(Accept|Use this plan|Clear|Yes)$/ })
  const yes = (await named.count()) > 0 ? named.first() : dialog.getByRole('button').filter({ hasNotText: /Cancel|Close|Not now/ }).first()
  if ((await yes.count()) === 0) return
  await yes.click()
  await page.waitForTimeout(300)
}

async function goTo(page: Page, view: string) {
  await page.getByRole('button', { name: view, exact: true }).first().click()
}

/** Whichever of these controls is on the screen, pressed. Absent is fine. */
async function pressIfThere(page: Page, name: RegExp | string): Promise<boolean> {
  const button = page.getByRole('button', { name }).first()
  if ((await button.count()) === 0) return false
  if (!(await button.isEnabled().catch(() => false))) return false
  await button.click()
  await page.waitForTimeout(200)
  return true
}

test('a week of ordinary use leaves the day adding up and the file loading', async ({ page }) => {
  test.slow()
  await page.clock.setFixedTime(SETUP)
  await openFresh(page)

  // A week to live in. Built from a starter rather than by hand: this test is
  // about what happens to a week, and the rehearsal already covers building
  // one.
  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A week/ }).click()
  await page.getByPlaceholder('Week name').fill('My week')
  await page.getByRole('group', { name: 'Add to' }).getByRole('button', { name: 'All days' }).click()
  for (const [time, title] of [
    ['07:00', 'Morning routine'],
    ['09:00', 'Deep work'],
    ['13:00', 'Meal'],
    ['18:00', 'Training'],
    ['21:00', 'Reading'],
  ] as const) {
    await page.getByPlaceholder('09:00').fill(time)
    await page.getByPlaceholder('What happens').fill(title)
    await page.getByPlaceholder('What happens').press('Enter')
  }
  // A block opens from the week picture, and Key lives in its panel.
  await page.locator('[data-wt-day="1"]').getByRole('button', { name: /^Deep work at / }).click()
  await page.getByRole('button', { name: 'Mark Deep work on Monday as a key task' }).click()
  await page.getByRole('button', { name: 'Save template' }).click()

  // Every weekday points at it, so opening a day is enough to plan it.
  await goTo(page, 'Settings')
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await page.getByLabel(`Template for ${day}`).selectOption({ label: 'My week' })
  }

  // --- Monday: a normal day. Some done, the rest pushed. ------------------
  await page.clock.setFixedTime(dayAt(0, 20))
  await page.reload()
  await goTo(page, 'Today')
  // The drawn box, not the input: the real checkbox is zero-width and sits
  // behind it, so it is the box a finger hits and the box a test has to.
  const ticks = page.locator('.task-list .check')
  // A one-off, left unfinished. Without one there is nothing for the banner
  // to move: every block on this week is on every day, so the rollover
  // correctly skips them all - a routine task tomorrow is getting anyway is
  // not a task that needs pushing. The first version of this soak expected a
  // push the app was right to refuse.
  await page.getByPlaceholder('Add a task').fill('Call the bank')
  await page.getByPlaceholder('Add a task').press('Enter')
  await page.waitForTimeout(300)
  const toTick = Math.min(3, await ticks.count())
  for (let i = 0; i < toTick; i++) await ticks.nth(i).click()
  await page.waitForTimeout(300)
  // Unanchored: the button's own name opens with an arrow glyph, so `^Push`
  // matched nothing and the push silently never happened.
  // Monday leaves things unfinished on purpose. What moves them is the
  // yesterday banner on Tuesday, which is the gesture the owner actually
  // uses - the evening card's own push is not up at 20:00, and a soak that
  // waits for it pushes nothing all week.
  await checkDay(page, 'Monday')

  // --- Tuesday: a low day. --------------------------------------------
  await page.clock.setFixedTime(dayAt(1, 9))
  await page.reload()
  await goTo(page, 'Today')
  const didPush = await pressIfThere(page, 'Push to today')
  expect(didPush, 'the yesterday banner did not offer to move anything').toBe(true)
  // Asserted here rather than at the end of the week: a gesture checked six
  // days later is a gesture nobody can tell did nothing.
  expect(await count(page, 'pushed'), 'the banner moved nothing').toBeGreaterThan(0)
  if (await pressIfThere(page, 'Low day')) await confirm(page)
  // Asserted where it happens. Every gesture here skips a control that is
  // not on the screen, which is also how a soak stops soaking - so each one
  // has to say what it left behind.
  expect(await count(page, 'low'), 'the low day did not take').toBeGreaterThan(0)
  await checkDay(page, 'Tuesday')

  // --- Wednesday: something came up, for an unknown length, and back. -----
  await page.clock.setFixedTime(dayAt(2, 11))
  await page.reload()
  await goTo(page, 'Today')
  if (await pressIfThere(page, 'Replan')) {
    await pressIfThere(page, /Something came up/)
    await pressIfThere(page, /Do not know how long|Don't know|Not sure/)
    await pressIfThere(page, /^Accept|^Use this plan|^Replan the day/)
    await page.keyboard.press('Escape')
  }
  expect(await count(page, 'replanned'), 'the replan changed no day').toBeGreaterThan(0)
  {
  }
  await checkDay(page, 'Wednesday')

  // --- Thursday: away for the afternoon ---------------------------------
  // The day pauses: nothing nudges and nothing counts against you while you
  // are not there.
  //
  // Nothing in this app has ever had a "Set aside" menu item - the first
  // version of this step opened a task's menu and pressed a control that
  // does not exist, then carried on, which is why it passed while doing
  // nothing. The flag is written in exactly one place, the return half of
  // this door, and it only writes it for a task that no longer fits in what
  // is left of the day. Producing that needs a day shaped for it rather than
  // the ordinary week this soak lives on, so what is asserted here is the
  // half this day can honestly reach: the day pauses. The return half is
  // covered by replan.e2e.ts, on a day built for it.
  await page.clock.setFixedTime(dayAt(3, 13))
  await page.reload()
  await goTo(page, 'Today')
  await pressIfThere(page, 'Replan')
  await pressIfThere(page, /^Away/)
  // The door and its confirm carry the same word, so the second press is
  // the one inside the sheet.
  await page.getByRole('dialog').getByRole('button', { name: 'Away', exact: true }).click()
  await page.waitForTimeout(400)
  expect(await count(page, 'away'), 'the day did not pause').toBeGreaterThan(0)
  await checkDay(page, 'Thursday')
  // --- Friday: the journal, on a day that has one. -----------------------
  await page.clock.setFixedTime(dayAt(4, 22))
  await page.reload()
  await goTo(page, 'Today')
  if (await pressIfThere(page, 'Journal')) {
    // The day's own field, by name. A blind sweep of every textbox found
    // the search box first and wrote the day into it.
    const box = page.getByLabel(/^Journal for /).first()
    if (await box.count()) {
      await box.fill('It went the way most of them go.')
      await box.blur()
      // The journal saves on a 500ms debounce, so a shorter wait reads as a
      // journal that saved nothing.
      await page.waitForTimeout(900)
    }
    await page.keyboard.press('Escape')
  }
  expect(await count(page, 'journals'), 'the journal saved nothing').toBeGreaterThan(0)
  await checkDay(page, 'Friday')

  // --- Saturday: a note with a picture on it. ----------------------------
  await page.clock.setFixedTime(dayAt(5, 12))
  await page.reload()
  await goTo(page, 'Today')
  // The keyboard, not the header button: 's' is how the app opens Scratch
  // ready to write, and the header's own Notes opens it reading.
  await page.keyboard.press('s')
  await page.waitForTimeout(400)
  {
    // Enter is what keeps a note - see Scratch.tsx. Filling the box and
    // pressing Escape writes nothing, which is what the first version did.
    const field = page.getByRole('textbox', { name: 'Note', exact: true }).first()
    await field.waitFor({ timeout: 5000 }).catch(() => {})
    expect(await field.count(), 'the notes panel opened without a field in it').toBeGreaterThan(0)
    {
      await field.fill('Bought the thing. Receipt is in the drawer.')
      await field.press('Enter')
      await page.waitForTimeout(400)
    }
    const file = page.locator('input[type="file"]').first()
    if (await file.count()) {
      // A one-pixel PNG: the bytes go to IndexedDB and only the id to the
      // store, which is the thing worth proving still loads.
      await file.setInputFiles({
        name: 'shot.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        ),
      })
      await page.waitForTimeout(500)
    }
    await page.keyboard.press('Escape')
  }
  expect(await count(page, 'notes'), 'the note saved nothing').toBeGreaterThan(0)
  const withPicture = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return (data.scratch ?? []).filter((n: { photos?: unknown[] }) => (n.photos ?? []).length > 0).length
  })
  // The bytes live in IndexedDB and only the id on the note - see
  // Note.photos. This is the half that has to survive a reload.
  expect(withPicture, 'the picture did not attach to the note').toBeGreaterThan(0)
  await checkDay(page, 'Saturday')

  // --- Sunday: the day cleared, then stamped again. ----------------------
  // The one gesture that has doubled a day before, which is why it is here
  // rather than in the list of things nobody checks.
  await page.clock.setFixedTime(dayAt(6, 10))
  await page.reload()
  await goTo(page, 'Today')
  const beforeClear = await read(page)
  if (await pressIfThere(page, /Clear this day/)) await confirm(page)
  await page.locator('.template-rail').getByRole('button', { name: 'My week' }).click()
  await page.waitForTimeout(300)
  await checkDay(page, 'Sunday')
  const afterStamp = await read(page)
  // Re-stamping a cleared day gives the day back, not two of it.
  expect(afterStamp.tasks).toBeLessThanOrEqual(beforeClear.tasks + 5)

  // --- did the week actually happen -------------------------------------
  // Every gesture above is written to skip a control that is not there, so
  // that one missing button does not fail the run. That is also how a soak
  // quietly stops soaking. This is the guard on the guard: if the week
  // below is empty, the run above pressed nothing and its clean report
  // means nothing.
  const lived = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const days = Object.values(data.days ?? {}) as {
      tasks?: { done?: boolean; pushCount?: number; setAside?: boolean }[]
      journal?: unknown
      dayType?: string
      lowDay?: boolean
    }[]
    return {
      days: days.length,
      done: days.reduce((n, d) => n + (d.tasks ?? []).filter(t => t.done).length, 0),
      pushed: days.reduce((n, d) => n + (d.tasks ?? []).filter(t => (t.pushCount ?? 0) > 0).length, 0),
      journals: days.filter(d => d.journal).length,
      notes: (data.scratch?.notes ?? data.notes ?? []).length,
    }
  })
  expect(lived.days, 'no day was touched at all').toBeGreaterThanOrEqual(5)
  expect(lived.done, 'nothing was ticked off all week').toBeGreaterThan(0)
  expect(lived.pushed, 'nothing was ever pushed: ' + JSON.stringify(lived)).toBeGreaterThan(0)

  // --- and the whole week, out and back in ------------------------------
  await goTo(page, 'Settings')
  const before = await page.evaluate(() => localStorage.getItem('dienius:data') || '')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await (await download).path()
  if (file) {
    await page.locator('input[type="file"]').first().setInputFiles(file)
    await page.waitForTimeout(600)
    await pressIfThere(page, /^Import|^Replace|^Yes/)
    const after = await page.evaluate(() => localStorage.getItem('dienius:data') || '')
    // Field for field the same thing. Compared as parsed objects rather than
    // as text, because key order is not a promise anybody made.
    const same = await page.evaluate(
      ([a, b]) => {
        const sort = (x: unknown): unknown =>
          Array.isArray(x)
            ? x.map(sort)
            : x && typeof x === 'object'
              ? Object.fromEntries(Object.entries(x as object).sort(([p], [q]) => p.localeCompare(q)).map(([k, v]) => [k, sort(v)]))
              : x
        return JSON.stringify(sort(JSON.parse(a))) === JSON.stringify(sort(JSON.parse(b)))
      },
      [before, after],
    )
    expect(same, 'export then import is not the same file').toBe(true)
  }
})
