import { expect, test, type Page } from '@playwright/test'
import { goToDay, openFreshAt, wednesdayAt } from './app'

/**
 * Kitchen, walked end to end on both screens - v2.27.
 *
 * The jsdom tests hold each part: the model and the file, the parser, the
 * list, the page, the form and a meal on the day. What they cannot see is the
 * whole of it in a real browser at a real size: a recipe written from nothing,
 * read back as a list and numbered steps, found by a chip and by a word in its
 * text, and a meal on the day opening it. The phone's walk also measures what a
 * finger needs - the meals wrapping inside the screen. Cook went in v2.30.
 *
 * Since v2.30 the walk goes on into a template: a recipe put into a meal block
 * from its own page, and the days stamped from that block taking its recipes
 * one a day. Every recipe here is a generic one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a recipe is written, read as a list and steps, and found by its meal and its words', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Kitchen', exact: true }).click()

  // Empty: what Kitchen is for, and the way to start.
  await expect(page.getByText('The recipes you cook, with what goes in them and how. Add the first one to start, or paste many at once.')).toBeVisible()
  await page.getByRole('button', { name: 'New recipe' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('A simple soup')
  await page.getByRole('textbox', { name: 'Recipe' }).fill(
    'Keeps for three days.\n\nINGREDIENTS\n250 g red lentils\n1 onion\n\nSTEPS\n1. Soften the onion.\n2. Add the lentils and simmer.',
  )
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('group', { name: 'Meals' }).getByRole('button', { name: 'Dinner' }).click()
  await page.getByRole('spinbutton', { name: 'kcal' }).fill('420')
  await page.getByRole('spinbutton', { name: 'Protein (g)' }).fill('22')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // Read back on its page.
  await expect(page.getByRole('heading', { level: 2, name: 'A simple soup' })).toBeVisible()
  await expect(page.getByText('420 kcal · 22 g protein per serving')).toBeVisible()
  await expect(page.getByRole('list', { name: 'INGREDIENTS' }).getByRole('listitem')).toHaveText(['250 g red lentils', '1 onion'])
  await expect(page.getByRole('list', { name: 'STEPS' }).getByRole('listitem')).toHaveText(['Soften the onion.', 'Add the lentils and simmer.'])

  // A second recipe, for the list to choose between.
  await page.getByRole('button', { name: 'Kitchen', exact: true }).last().click()
  await page.getByRole('button', { name: 'New recipe' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Overnight oats')
  await page.getByRole('textbox', { name: 'Recipe' }).fill('Oats and milk, left in the fridge overnight.')
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('group', { name: 'Meals' }).getByRole('button', { name: 'Breakfast' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Kitchen', exact: true }).last().click()

  // The cards, by meal: a meal's chip, and a word from inside a recipe.
  const rows = page.locator('.kitchen-card-title')
  await expect(page.locator('.kitchen-section-name')).toHaveText(['Breakfast', 'Dinner'])
  await expect(rows).toHaveText(['Overnight oats', 'A simple soup'])
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Breakfast' }).click()
  await expect(rows).toHaveText(['Overnight oats'])
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'All' }).click()
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('lentils')
  await expect(rows).toHaveText(['A simple soup'])
  if (phone) {
    // The meals are a strip that scrolls inside its own box - one look,
    // rule 5, a row stays a row - and the page never scrolls sideways.
    const overflow = await page.evaluate(() => {
      const chips = document.querySelector('.kitchen-chips') as HTMLElement
      return { strip: getComputedStyle(chips).overflowX, wrap: getComputedStyle(chips).flexWrap, page: document.documentElement.scrollWidth - window.innerWidth }
    })
    expect(overflow.strip).toBe('auto')
    expect(overflow.wrap).toBe('nowrap')
    expect(overflow.page).toBeLessThanOrEqual(0)
  }

  // A recipe's page reads it and edits it; there is nothing to cook from.
  await page.getByRole('button', { name: /^A simple soup/ }).click()
  await expect(page.getByText('Dinner', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cook', exact: true })).toHaveCount(0)
})

test("a meal on the day names its recipe, and a press on it opens the recipe's page", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.evaluate(() => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    const today = '2026-09-16'
    d.recipes = [{ id: 'soup', title: 'A simple soup', text: 'INGREDIENTS\n250 g red lentils\n\nSTEPS\nSimmer.' }]
    d.days = {
      ...(d.days ?? {}),
      [today]: {
        date: today,
        autoApplied: true,
        tasks: [
          { id: 'dinner', title: 'Dinner', time: '19:00', minutes: 40, done: false, category: 'meal', recipeId: 'soup' },
          { id: 'lunch', title: 'Lunch', time: '12:30', minutes: 40, done: false, category: 'meal', mealType: 'lunch' },
        ],
      },
    }
    localStorage.setItem(key, JSON.stringify(d))
  })
  await page.reload()

  await page.locator('.task-list').getByRole('button', { name: 'Recipe: A simple soup' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'A simple soup' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today', exact: true }).click()
  await page.locator('.task-list').getByRole('button', { name: 'Lunch recipes' }).click()
  await expect(page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Lunch' })).toHaveAttribute('aria-pressed', 'true')
})

/** Two generic dinners and a day template with a dinner block, written straight into the plan. */
async function planWithDinner(page: Page, recipeIds?: string[]): Promise<void> {
  await page.evaluate(ids => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    d.recipes = [
      { id: 'soup', title: 'A simple soup', text: '', mealTypes: ['dinner'] },
      { id: 'curry', title: 'A quick curry', text: '', mealTypes: ['dinner'] },
    ]
    d.templates = [
      {
        id: 'weekday',
        name: 'Weekday',
        color: '#a7c4f5',
        blocks: [
          {
            id: 'dinner',
            time: '19:00',
            title: 'Dinner',
            minutes: 45,
            category: 'meal',
            ...(ids ? { recipeIds: ids, recipeId: ids[0] } : {}),
          },
        ],
      },
    ]
    localStorage.setItem(key, JSON.stringify(d))
  }, recipeIds)
  await page.reload()
}

test("recipes go into a template's meal block from their own pages, and the block holds them in that order", async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await planWithDinner(page)
  const views = page.getByRole('navigation', { name: 'Views' })

  for (const title of ['A simple soup', 'A quick curry']) {
    await views.getByRole('button', { name: 'Kitchen', exact: true }).click()
    await page.getByRole('button', { name: new RegExp(title) }).first().click()
    await page.getByRole('button', { name: 'Add to template', exact: true }).click()
    await page.getByRole('radiogroup', { name: 'Into' }).getByRole('radio', { name: '19:00 Dinner' }).check()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Added to Dinner on Weekday.' })).toBeVisible()
    // The keys come back to the button the panel was opened from.
    await expect(page.getByRole('button', { name: 'Add to template', exact: true })).toBeFocused()
  }

  await views.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('button', { name: /^Edit Weekday/ }).first().click()
  const line = page.getByRole('button', { name: /^Recipes for Dinner: / })
  await expect(line).toHaveAccessibleName('Recipes for Dinner: A simple soup and 1 more')
  await line.click()
  await expect(page.getByRole('list', { name: 'Walked in this order' }).getByRole('listitem')).toHaveText([
    /A simple soup/,
    /A quick curry/,
  ])
  // Open, the field stays inside the screen - the phone's included.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('the days stamped from a meal block take its recipes, one a day', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', "the template rail is the wide layout's; a phone stamps a template from the calendar")
  await openFreshAt(page, wednesdayAt(10))
  await planWithDinner(page, ['soup', 'curry'])

  const recipeOn = async (date: string) => {
    await goToDay(page, date)
    await page.getByRole('button', { name: 'Weekday', pressed: false }).click()
    const pill = page.locator('.task-list').getByRole('button', { name: /^Recipe: / })
    await expect(pill).toHaveCount(1)
    return (await pill.getAttribute('aria-label'))!.replace('Recipe: ', '')
  }
  const wednesday = await recipeOn('2026-09-16')
  const thursday = await recipeOn('2026-09-17')
  expect([wednesday, thursday].sort()).toEqual(['A quick curry', 'A simple soup'])
})
