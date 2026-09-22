import { expect, test, type Page } from '@playwright/test'
import { goToDay, openFreshAt, wednesdayAt } from './app'

/**
 * Kitchen with many recipes, walked end to end on both screens - v2.32.
 *
 * The jsdom tests hold each part: the paste read into rows, the store's
 * import, the meals on a card, the words in Settings, a block that follows
 * its meal. What they cannot see is all of it at a real size: thirty recipes
 * pasted and saved on a phone as narrow as 375px with nothing reaching past
 * the screen, the same text pasted again making no second copy, one meal
 * given to several at once, and a template's meal block that follows Lunch
 * taking a recipe given Lunch after it was set. Every recipe here is a
 * generic one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

/** Thirty generic recipes in Kitchen's own shape: the numbers, the ingredients, the steps. */
function thirty(kcal = 300): string {
  return Array.from({ length: 30 }, (_, i) =>
    [`NAME: Lunch: Bowl number ${i + 1}`, `${kcal + i} kcal, ${10 + i} g protein`, '', 'INGREDIENTS', 'a grain', 'a vegetable', '', 'STEPS', 'Cook the grain.'].join('\n'),
  ).join('\n')
}

/** The phone the owner's screens are held to, or the desktop's own window. */
async function sized(page: Page, phone: boolean): Promise<void> {
  if (phone) await page.setViewportSize({ width: 375, height: 812 })
}

async function kitchen(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Kitchen', exact: true }).click()
}

/** How far the page reaches past the window sideways: nothing, ever. */
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** Whether a box stands wholly inside the window's width. */
async function inside(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate(el => {
    const r = el.getBoundingClientRect()
    return r.left >= 0 && r.right <= document.documentElement.clientWidth
  })
}

test('thirty recipes pasted at once are saved with one press, fit the screen, and pasted again make no second copy', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  await openFreshAt(page, wednesdayAt(10))
  await sized(page, phone)
  await kitchen(page)

  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(thirty())
  await expect(page.locator('.kitchen-paste-row')).toHaveCount(30)
  await expect(page.getByText('30 new')).toBeVisible()
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  // Every part of every row inside the screen, and each row's numbers and
  // meals in one column down the list.
  const rows = await page.locator('.kitchen-paste-row').evaluateAll(els =>
    els.map(el => {
      const numbers = el.querySelector('.kitchen-paste-numbers')!.getBoundingClientRect()
      const parts = [...el.children].map(c => c.getBoundingClientRect())
      return { numbers: Math.round(numbers.left), out: parts.some(p => p.right > document.documentElement.clientWidth + 0.5) }
    }),
  )
  expect(rows.some(r => r.out)).toBe(false)
  expect(new Set(rows.map(r => r.numbers)).size).toBe(1)

  // One row's meals changed in the row: its six open inside the screen.
  await page.getByRole('button', { name: 'Meals for Lunch: Bowl number 2: Lunch' }).click()
  await expect(page.getByRole('group', { name: 'Meals for Lunch: Bowl number 2' })).toBeVisible()
  expect(await inside(page, '.meals-picker-panel')).toBe(true)
  await page.getByRole('group', { name: 'Meals for Lunch: Bowl number 2' }).getByRole('button', { name: 'Dinner' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.locator('.kitchen-section-name')).toHaveText(['Lunch', 'Dinner'])
  await expect(page.locator('.kitchen-section-count')).toHaveText(['30', '1'])

  // The same text again: each row says it writes over the one there, and
  // Kitchen still has thirty - the meal given by hand kept.
  await page.getByRole('button', { name: 'Paste many' }).click()
  await page.getByRole('textbox', { name: 'Recipes' }).fill(thirty(500))
  await expect(page.getByText('30 updated')).toBeVisible()
  await expect(page.locator('.kitchen-paste-state').first()).toHaveText('Updates the one in Kitchen')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.kitchen-section-count')).toHaveText(['30', '1'])
  await expect(page.locator('.kitchen-card').first()).toContainText('500 kcal')
})

test("a card's meals change in place, and Select gives one meal to several recipes at once", async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  await openFreshAt(page, wednesdayAt(10))
  await sized(page, phone)
  await page.evaluate(() => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.recipes = [
      { id: 'a', title: 'A bean bowl', text: '' },
      { id: 'b', title: 'A lentil soup', text: '', mealTypes: ['dinner'] },
      { id: 'c', title: 'A rice dish', text: '' },
    ]
    localStorage.setItem(key, JSON.stringify(d))
  })
  await page.reload()
  await kitchen(page)

  await page.getByRole('button', { name: 'Meals for A bean bowl: No meal yet' }).click()
  expect(await inside(page, '.meals-picker-panel')).toBe(true)
  await page.getByRole('group', { name: 'Meals for A bean bowl' }).getByRole('button', { name: 'Breakfast' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Breakfast' }).locator('.kitchen-card-title')).toHaveText(['A bean bowl'])

  await page.getByRole('button', { name: 'Select' }).click()
  await page.locator('.kitchen-card-open', { hasText: 'A lentil soup' }).click()
  await page.locator('.kitchen-card-open', { hasText: 'A rice dish' }).click()
  await expect(page.getByText('2 picked')).toBeVisible()
  // The bar's rows each one row, inside the screen.
  expect(await sideways(page)).toBeLessThanOrEqual(0)
  const heights = await page.locator('.kitchen-picked-meal > *').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().height)))
  expect(new Set(heights).size).toBe(1)
  await page.getByRole('combobox', { name: 'Meal' }).selectOption('lunch')
  await page.getByRole('button', { name: 'Give' }).click()
  await expect(page.getByText('Lunch given to 2 recipes')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('region', { name: 'Lunch' }).locator('.kitchen-card-title')).toHaveText(['A lentil soup', 'A rice dish'])
})

test('a meal block that follows Lunch takes a recipe given Lunch after it was set', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', "the template rail is the wide layout's; a phone stamps a template from the calendar")
  await openFreshAt(page, wednesdayAt(10))
  await page.evaluate(() => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.recipes = [{ id: 'soup', title: 'A lentil soup', text: '', mealTypes: ['lunch'] }]
    d.templates = [
      {
        id: 'weekday',
        name: 'Weekday',
        color: '#a7c4f5',
        blocks: [{ id: 'lunch', time: '12:30', title: 'Lunch', minutes: 45, category: 'meal' }],
      },
    ]
    localStorage.setItem(key, JSON.stringify(d))
  })
  await page.reload()
  const views = page.getByRole('navigation', { name: 'Views' })

  // All Lunch, then follow it.
  await views.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('button', { name: /^Edit Weekday/ }).first().click()
  await page.getByRole('button', { name: /^Recipes for Lunch: / }).click()
  await page.getByRole('button', { name: 'All Lunch' }).click()
  await page.getByRole('switch', { name: 'Follow Lunch' }).click()
  await expect(page.getByRole('button', { name: /^Recipes for Lunch: / })).toHaveAccessibleName('Recipes for Lunch: Every Lunch recipe, in turn')
  await page.getByRole('button', { name: 'Save template' }).click()

  // A second lunch, given Lunch on its card after the block was set.
  await page.evaluate(() => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.recipes.push({ id: 'bowl', title: 'A bean bowl', text: '' })
    localStorage.setItem(key, JSON.stringify(d))
  })
  await page.reload()
  await views.getByRole('button', { name: 'Kitchen', exact: true }).click()
  await page.getByRole('button', { name: 'Meals for A bean bowl: No meal yet' }).click()
  await page.getByRole('group', { name: 'Meals for A bean bowl' }).getByRole('button', { name: 'Lunch' }).click()

  // Two days stamped from the block: one of each, the new one among them.
  await views.getByRole('button', { name: 'Today', exact: true }).click()
  const recipeOn = async (date: string) => {
    await goToDay(page, date)
    await page.getByRole('button', { name: 'Weekday', pressed: false }).click()
    const pill = page.locator('.task-list').getByRole('button', { name: /^Recipe: / })
    await expect(pill).toHaveCount(1)
    return (await pill.getAttribute('aria-label'))!.replace('Recipe: ', '')
  }
  const wednesday = await recipeOn('2026-09-16')
  const thursday = await recipeOn('2026-09-17')
  expect([wednesday, thursday].sort()).toEqual(['A bean bowl', 'A lentil soup'])
})
