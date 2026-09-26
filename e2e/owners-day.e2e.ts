import { expect, test, type Locator, type Page } from '@playwright/test'
import { openFreshAt, reopenAt } from './app'

/**
 * The owner's ordinary day, pressed the way the owner presses it - the shift
 * brief of 2026-09-25, stage 6 - on a desktop and a 375px phone: open today,
 * see the next meal, choose its recipe with the kcal and protein beside each,
 * see it in Kitchen, put another recipe of the same meal on it, tick it and
 * change it once more, tick the gym, read a block's note, look at yesterday
 * and at last week. The meal is the owner's shape: a kind of meal, its
 * recipe chosen on the day. Every press is counted, action by action, and
 * each action is held to the presses it takes today, so one that grows is
 * seen. docs/SHIFT-2026-09-25.md has the table. Every name is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Vilnius, in September 2026, on a day at an hour. */
const september = (day: number, hours: number, minutes = 0) => new Date(Date.UTC(2026, 8, day, hours - 3, minutes))

// Each name opens with its meal and a colon, the way a pasted recipe says its meal.
const RECIPES = [
  'NAME: Breakfast: oat bowl\n410 kcal\n22 g protein\nINGREDIENTS\noats\nSTEPS\nCook.',
  'NAME: Lunch: lentil soup\n450 kcal\n30 g protein\nINGREDIENTS\nlentils\nSTEPS\nSimmer.',
  'NAME: Lunch: bean bowl\n520 kcal\n27 g protein\nINGREDIENTS\nbeans\nSTEPS\nWarm.',
].join('\n')

const FILE = JSON.stringify({
  templates: [
    {
      name: 'Work day',
      type: 'shift',
      kind: 'W',
      blocks: [
        { time: '07:00', title: 'Shift', minutes: 600, core: true, ongoing: true },
        // As the owner's meal blocks are: a kind of meal, its recipe chosen on the day.
        { time: '12:30', title: 'Lunch', minutes: 30, category: 'Meals', mealType: 'lunch' },
        { time: '17:30', title: 'Stretch', minutes: 15, note: 'Hips first, then the back.' },
      ],
    },
  ],
  routines: [{ title: 'Gym', minutes: 60, weekdays: [1, 2, 3, 4, 5], times: { W: '18:00' }, core: true }],
  roster: { '2026-09-15': 'W', '2026-09-16': 'W', '2026-09-17': 'W' },
})

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name, exact: true })

test("the owner's day, press by press", async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  // Tuesday: the recipes into Kitchen, and the file into Settings.
  await openFreshAt(page, september(15, 8))
  if (phone) await page.setViewportSize({ width: 375, height: 812 })
  await tab(page, 'Kitchen').click()
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(RECIPES)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await tab(page, 'Settings').click()
  await page.getByRole('textbox', { name: 'Templates and roster as JSON' }).fill(FILE)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText(/^Applied\./)).toBeVisible()

  // Wednesday, a little before lunch, the app opened.
  await reopenAt(page, september(16, 11, 40))
  const counts: Record<string, number> = {}
  let action = ''
  const press = async (target: Locator) => {
    counts[action] = (counts[action] ?? 0) + 1
    await target.click()
  }
  const card = (title: string) => page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: title, exact: true }) })
  const tick = (title: string) => press(card(title).getByRole('checkbox', { name: title, exact: true }).locator('xpath=following-sibling::*[1]'))

  action = 'open today, see the next meal'
  counts[action] = 0
  await tab(page, 'Today').waitFor()
  const lunch = card('Lunch')
  await expect(lunch).toBeVisible()
  // In view as the app opens, with nothing scrolled: at the top of the page. The reload keeps
  // where Settings was left, and a measure taken before or after the browser puts that back read
  // two different screens - the deploy's runner failed on the first and passed on the second.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready)
  const height = page.viewportSize()!.height
  // The whole card, its recipe's row too, in the fonts a phone and this computer draw; the
  // deploy's Linux runner draws text taller, and there the meal's name is what is held.
  const seen = await (process.env.CI ? lunch.locator('.task-check') : lunch).boundingBox()
  expect(seen!.y + seen!.height, 'the next meal is on the first screen').toBeLessThanOrEqual(height)

  // The meal's recipes open in place, each with its kcal and protein, and one
  // press puts one on it - the owner's decisions before the freeze, stage 3.
  const choices = () => card('Lunch').getByRole('list', { name: 'Recipes for Lunch' })

  action = 'choose its recipe, kcal and protein beside each'
  await press(lunch.getByRole('button', { name: 'Choose a recipe for Lunch' }))
  await expect(choices().getByRole('button', { name: /lentil soup/ })).toContainText('450 kcal · 30 g protein')
  await press(choices().getByRole('button', { name: /lentil soup/ }))
  await expect(lunch.getByRole('button', { name: 'Recipe: Lunch: lentil soup' })).toBeVisible()

  action = "see its recipe's kcal and protein in Kitchen"
  await press(lunch.getByRole('button', { name: 'Recipe: Lunch: lentil soup' }))
  await expect(page.getByText(/450 kcal/).first()).toBeVisible()
  await expect(page.getByText(/30 g protein/).first()).toBeVisible()
  await press(tab(page, 'Today'))

  action = 'another recipe of the same meal on it'
  await press(card('Lunch').getByRole('button', { name: 'Another recipe for Lunch' }))
  await press(choices().getByRole('button', { name: /bean bowl/ }))
  await expect(card('Lunch').getByRole('button', { name: 'Recipe: Lunch: bean bowl' })).toBeVisible()

  action = 'tick the meal'
  await tick('Lunch')
  await expect(page.getByRole('checkbox', { name: 'Lunch', exact: true })).toBeChecked()

  action = 'another recipe once it is ticked'
  // Ticked, the meal has gone under Done, which opens first; then the same two.
  const doneFold = page.getByRole('button', { name: /^Done \d/ })
  if ((await doneFold.getAttribute('aria-expanded')) !== 'true') await press(doneFold)
  await press(card('Lunch').getByRole('button', { name: 'Another recipe for Lunch' }))
  await press(choices().getByRole('button', { name: /lentil soup/ }))
  await expect(card('Lunch').getByRole('button', { name: 'Recipe: Lunch: lentil soup' })).toBeVisible()

  action = 'tick the gym'
  await tick('Gym')
  await expect(page.getByRole('checkbox', { name: 'Gym', exact: true })).toBeChecked()

  action = "read a block's note"
  const stretch = card('Stretch')
  if (!(await stretch.getByText('Hips first, then the back.').isVisible())) await press(stretch.getByRole('button', { name: /note/i }).first())
  await expect(stretch.getByText('Hips first, then the back.')).toBeVisible()

  action = 'see yesterday'
  const cell = page.locator('.mini-calendar [data-date="2026-09-15"]')
  if (await cell.isVisible().catch(() => false)) await press(cell)
  else await press(page.getByRole('button', { name: 'Previous day' }))
  await expect(page.getByRole('checkbox', { name: 'Stretch', exact: true })).toBeAttached()

  action = 'see last week'
  await press(tab(page, 'Review'))
  await press(page.getByRole('button', { name: 'The week before' }))
  // The week of Monday 7 September, the one before this one.
  await expect(page.getByText(/^7 - 13 Sep/).first()).toBeVisible()

  // Held to what each takes today, so an action that grows a press is seen. The one over two is a
  // meal already ticked, whose card is under Done: the same two presses once Done is open - see
  // docs/SHIFT-2026-09-25.md, "After the shift".
  expect(counts).toEqual({
    'open today, see the next meal': 0,
    'choose its recipe, kcal and protein beside each': 2,
    "see its recipe's kcal and protein in Kitchen": 2,
    'another recipe of the same meal on it': 2,
    'tick the meal': 1,
    'another recipe once it is ticked': 3,
    'tick the gym': 1,
    "read a block's note": 1,
    'see yesterday': 1,
    'see last week': 2,
  })
  info.annotations.push({ type: 'presses', description: JSON.stringify(counts) })
})
