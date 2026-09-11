import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A whole week, built through the screen, in the shape a real one has.
 *
 * Not a feature test - every part of this is covered somewhere else. This is
 * the rehearsal: the owner sits down and builds their actual week, and the
 * question is whether anything on that path snags. A field that will not take
 * a value, a button out of reach, a note that does not save, a scope that
 * lands somewhere unexpected - each of those is invisible to a test that
 * exercises one control at a time and obvious to somebody doing all of it in
 * one sitting.
 *
 * **The content is generic on purpose.** This repo is public. The structure
 * is the owner's - a rotation across three pairs of days, meals carrying
 * notes, a morning routine written out as one, a rest day at the weekend -
 * and none of the words are. See `scripts/no-personal-data.mjs`.
 *
 * It also counts presses, which is the number this design is judged on: a
 * week that costs more than a hundred and twenty is a week nobody rebuilds.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

/** Every press, so the total is measured rather than estimated. */
let presses = 0

async function press(page: Page, name: string | RegExp, within?: string) {
  const scope = within ? page.locator(within) : page
  await scope.getByRole('button', { name }).first().click()
  presses += 1
}

async function fill(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).first().fill(value)
  presses += 1
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAYS = DAYS.slice(0, 5)
const WEEKEND = DAYS.slice(5)

const same = (a: string[], b: string[]) => a.length === b.length && a.every(d => b.includes(d))

/**
 * The switches for the next block, set to exactly these days - through a
 * preset where one says it, and switch by switch where none does.
 *
 * An empty list means "leave them as they are", which is the whole point of
 * the switches surviving an add: a run of blocks on the same days costs
 * nothing after the first.
 */
/**
 * Opens the add row if a block being read has folded it away - see addOpen
 * in WeekTemplateEditor. Since v2.17 the two are not both open by default:
 * a walk that edits a block and then adds another does what a person does,
 * which is press the one line that brings the form back.
 */
async function openAddRow(page: Page) {
  const folded = page.locator('.block-add-open')
  if ((await folded.count()) === 0) return
  await folded.click()
  presses += 1
}

async function addTo(page: Page, days: string[]) {
  if (days.length === 0) return
  await openAddRow(page)
  const where = page.getByRole('group', { name: 'Add to' })
  const preset = same(days, DAYS) ? 'All days' : same(days, WEEKDAYS) ? 'Weekdays' : same(days, WEEKEND) ? 'Weekend' : null
  if (preset) {
    await where.getByRole('button', { name: preset }).click()
    presses += 1
    return
  }
  for (const day of DAYS) {
    const button = where.getByRole('button', { name: day, exact: true })
    const on = (await button.getAttribute('aria-pressed')) === 'true'
    if (on !== days.includes(day)) {
      await button.click()
      presses += 1
    }
  }
}

/**
 * One block: the days, a time, and a title ending in Return.
 *
 * Return is what adds it - the same gesture quick-add takes on the day - so
 * the button beside the field is a second way and not the way, and typing a
 * title and pressing it is one act rather than two.
 */
async function block(page: Page, time: string, title: string, days: string[] = []) {
  await addTo(page, days)
  await openAddRow(page)
  await fill(page, '09:00', time)
  await page.getByPlaceholder('What happens').first().fill(title)
  await page.getByPlaceholder('What happens').first().press('Enter')
  presses += 1
}

/** Monday's column, where every per-block edit below is made. */
const MON = '[data-wt-day="1"]'

/**
 * Opens a block from the week picture. Key, Note and Remove live in the
 * panel under the grid - a column is a seventh of the editor and four
 * controls do not fit across one.
 */
async function openBlock(page: Page, title: string) {
  await page.locator(MON).getByRole('button', { name: new RegExp(`^${title} at `) }).first().click()
  presses += 1
}

test("a week of the owner's own shape is built through the screen", async ({ page }) => {
  test.slow()
  await openFreshAt(page, wednesdayAt(7))
  presses = 0

  await press(page, 'Templates')
  await press(page, 'New template')
  await press(page, /^A week/)
  await fill(page, 'Week name', 'My week')

  // Seven on every day: the morning, three meals, two reading blocks and the
  // evening. The spine a week hangs off, and the switches are set once for
  // all seven of them.
  await block(page, '07:00', 'Morning routine', DAYS)
  await block(page, '08:00', 'Meal')
  await block(page, '13:00', 'Meal')
  await block(page, '19:00', 'Meal')
  await block(page, '12:00', 'Reading')
  await block(page, '21:00', 'Reading')
  await block(page, '22:30', 'Evening close')

  // The morning gets its four lines once, and every day it is on takes them.
  await openBlock(page, 'Morning routine')
  await page.getByLabel('Note on Morning routine').fill(['- Water', '- Light', '- Meditation (10 min)', '- Out of the room'].join(String.fromCharCode(10)))
  presses += 1

  // A meal arrives carrying what to make. Three of them, a note each.
  const mealNotes = ['Eggs, oats, fruit.', 'Rice, protein, something green.', 'Soup and bread.']
  for (let i = 0; i < 3; i++) {
    // Always the first meal that has no note yet: a block that gets one
    // renames its own button, so an index into this list would walk past the
    // meal it was aiming at.
    await page.locator(MON).getByRole('button', { name: /^Meal at / }).nth(i).click()
    presses += 1
    await page.getByLabel('Note on Meal').fill(mealNotes[i])
    presses += 1
  }

  // Seven on the weekdays. Two are the day's key tasks, and one carries a
  // note of its own.
  await block(page, '09:00', 'Deep work', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
  await block(page, '11:00', 'Admin')
  await block(page, '14:00', 'Second block')
  await block(page, '16:00', 'Errands')
  await block(page, '17:00', 'Commute')
  await block(page, '20:00', 'Practice')
  await block(page, '20:45', 'Tidy')

  await openBlock(page, 'Deep work')
  await press(page, 'Mark Deep work on Monday as a key task')
  await openBlock(page, 'Practice')
  await press(page, 'Mark Practice on Monday as a key task')
  await page.getByLabel('Note on Practice').fill(['Slow first, then up to tempo.', '', '- Warm up (5 min)'].join(String.fromCharCode(10)))
  presses += 1

  // One on the weekend only.
  await block(page, '10:00', 'Long walk', ['Saturday', 'Sunday'])

  // The rotation: three pairs and one triple, none of which has a name. This
  // is the shape that cost two passes per block before the day switches, and
  // the reason they exist.
  await block(page, '18:30', 'Training A', ['Monday', 'Wednesday', 'Friday'])
  await block(page, '18:30', 'Training B', ['Tuesday', 'Thursday'])
  await block(page, '06:30', 'Light training', ['Monday', 'Thursday'])
  await block(page, '06:30', 'Stretch', ['Tuesday', 'Friday'])
  await block(page, '06:30', 'Mobility', ['Wednesday', 'Saturday'])

  // Two only on Saturday, two only on Sunday.
  await block(page, '11:00', 'Shopping', ['Saturday'])
  await block(page, '15:00', 'Repairs')
  await block(page, '11:00', 'Plan the week', ['Sunday'])
  await block(page, '15:00', 'Call home')

  // Sunday is a rest day.
  await press(page, /^Day type for Sunday/, '[data-wt-day="0"]')
  await page.locator('[data-wt-day="0"]').getByLabel('Day type for Sunday').selectOption('rest')
  presses += 1

  await press(page, 'Save template')

  // What landed, checked as a shape rather than as a count of clicks.
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const t = data.templates[0]
    const on = (title: string) =>
      t.blocks.filter((b: { title: string }) => b.title === title).map((b: { weekday: number }) => b.weekday).sort()
    return {
      kind: t.kind,
      blocks: t.blocks.length,
      notes: t.blocks.filter((b: { note?: string }) => b.note).length,
      keys: t.blocks.filter((b: { highlight?: boolean }) => b.highlight).length,
      sundayType: t.weekDays?.['0']?.type,
      trainingA: on('Training A'),
      trainingB: on('Training B'),
      light: on('Light training'),
      stretch: on('Stretch'),
      mobility: on('Mobility'),
      shopping: on('Shopping'),
      planTheWeek: on('Plan the week'),
    }
  })

  expect(saved.kind).toBe('week')
  // Seven on all seven days, seven on five weekdays, one on two weekend
  // days, three rotations and four single-day blocks.
  expect(saved.blocks).toBe(49 + 35 + 2 + 3 + 2 + 2 + 2 + 2 + 1 + 1 + 1 + 1)
  expect(saved.trainingA).toEqual([1, 3, 5])
  expect(saved.trainingB).toEqual([2, 4])
  expect(saved.light).toEqual([1, 4])
  expect(saved.stretch).toEqual([2, 5])
  expect(saved.mobility).toEqual([3, 6])
  expect(saved.shopping).toEqual([6])
  expect(saved.planTheWeek).toEqual([0])
  expect(saved.sundayType).toBe('rest')
  // Three meals and the morning on seven days each, and the practice on
  // five - every one of them a note now that steps are lines in one.
  expect(saved.notes).toBe(28 + 5)
  // Two key blocks on five weekdays each, and no day over three.
  expect(saved.keys).toBe(10)

  console.log(`the week took ${presses} presses`)
  expect(presses).toBeLessThan(120)
})

test('the week map, North, a full list and the backup form all take what is typed', async ({ page }) => {
  test.slow()
  await openFreshAt(page, wednesdayAt(7))
  let steps = 0

  // --- a template per weekday ------------------------------------------
  // One template, then all seven days pointed at it, which is what makes a
  // day open already planned rather than empty.
  await page.getByRole('button', { name: 'Templates', exact: true }).first().click()
  await page.getByRole('button', { name: 'New template' }).click()
  await page.getByRole('button', { name: /^A day/ }).click()
  await page.getByPlaceholder('Template name').fill('Weekday')
  await page.getByPlaceholder('What happens').fill('Morning routine')
  await page.getByPlaceholder('What happens').press('Enter')
  await page.getByRole('button', { name: 'Save template' }).click()

  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await page.getByLabel(`Template for ${day}`).selectOption({ label: 'Weekday' })
    steps += 1
  }
  const mapped = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return Object.values(data.settings.weekdayTemplates).filter(Boolean).length
  })
  expect(mapped).toBe(7)

  // --- the sleep window, one schedule for the whole week -----------------
  await page.getByLabel('Bedtime').first().fill('23:00')
  await page.getByLabel('Wake time').first().fill('07:00')
  const sleep = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    const profile = data.settings.sleepProfiles[0]
    return `${profile.window.start}-${profile.window.end}`
  })
  expect(sleep).toBe('23:00-07:00')

  // --- North: a picture, three goals, and what each is worth ------------
  await page.getByRole('button', { name: 'North', exact: true }).first().click()
  // The picture is written on the page itself, not behind Compose - it is
  // the one line North opens on, and Compose is for everything under it.
  await page.getByLabel('The picture').fill('The week runs without me holding it up.')
  await page.getByRole('button', { name: 'Keep it' }).click()
  await page.getByRole('button', { name: 'Compose' }).click()

  const goals = [
    ['Be someone who finishes', 'Because half-done work is the thing that wears me out.', 'I am someone who ships.'],
    ['Get strong and stay strong', 'Because everything else is easier when the body is.', 'I am someone who trains.'],
    ['Keep learning on purpose', 'Because drifting is what happens by default.', 'I am someone who reads.'],
  ]
  for (let i = 0; i < goals.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add another' }).click()
    const [what, why, who] = goals[i]
    await page.getByLabel('What', { exact: true }).nth(i).fill(what)
    await page.getByLabel('Why it matters').nth(i).fill(why)
    await page.getByLabel('Who it makes you').nth(i).fill(who)
    await page.getByLabel('What I do to deserve this').nth(i).fill('One thing a day\nOne thing a week\nOne thing a month')
    steps += 4
  }
  await page.getByRole('button', { name: 'Save' }).click()

  const north = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return {
      picture: (data.picture?.text ?? '').length > 0,
      goals: (data.goals ?? []).length,
      deserve: (data.goals ?? []).map((g: { deserve?: string[] }) => (g.deserve ?? []).length),
    }
  })
  expect(north.picture).toBe(true)
  expect(north.goals).toBe(3)
  // Three lines each, which is what was typed - a textarea that quietly
  // dropped the second and third would be invisible on screen.
  expect(north.deserve).toEqual([3, 3, 3])

  // --- a list with twenty-one things on it ------------------------------
  await page.getByRole('button', { name: 'Library', exact: true }).first().click()
  await page.getByRole('button', { name: /Start a Books list|New list/ }).first().click()
  const nameField = page.getByLabel('List name')
  if (await nameField.count()) {
    await nameField.fill('Reading')
    await page.getByRole('button', { name: 'chapter' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
  }
  const add = page.getByLabel(/^Add to /).first()
  for (let i = 1; i <= 21; i++) {
    await add.fill(`Book number ${i}, 12 chapters`)
    await add.press('Enter')
    steps += 1
  }
  const items = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return data.library[0].items.length
  })
  expect(items).toBe(21)

  // --- the backup form, filled to the point it would send ---------------
  // A made-up token: this checks that the form takes a repo and a token and
  // arms its own button, and it never reaches the network.
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.getByPlaceholder('you/dienius-data').fill('someone/dienius-data')
  await page.getByPlaceholder('github_pat_…').fill('github_pat_0000000000000000000000_0000000000000000000000000000000000000000000000000000000000')
  // Save appears only once both fields hold something, and it is the only
  // button on this form that would ever reach the network. It is not
  // pressed: the token is invented, and the point is that the form takes
  // the pair and arms itself.
  const save = page.locator('.sync-actions').getByRole('button', { name: 'Save' })
  await expect(save).toBeEnabled()

  console.log(`the rest of the setup took ${steps} typed answers`)
})
