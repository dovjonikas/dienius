import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * Kitchen, walked end to end on both screens - v2.27.
 *
 * The jsdom tests hold each part: the model and the file, the parser, the
 * list, the page, the form and a meal on the day. What they cannot see is the
 * whole of it in a real browser at a real size: a recipe written from nothing,
 * read back as a list and numbered steps, found by a chip and by a word in its
 * text, and a meal on the day opening it. The phone's walk also measures what a
 * finger needs - the meals wrapping inside the screen. Cook went in v2.30.
 * Every recipe here is a generic one.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a recipe is written, read as a list and steps, and found by its meal and its words', async ({ page }, info) => {
  const phone = info.project.name === 'phone'
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Kitchen', exact: true }).click()

  // Empty: what Kitchen is for, and the way to start.
  await expect(page.getByText('The recipes you cook, with what goes in them and how. Add the first one to start.')).toBeVisible()
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

  // The list: a meal's chip, and a word from inside a recipe.
  const rows = page.locator('.kitchen-row-title')
  await expect(rows).toHaveText(['A simple soup', 'Overnight oats'])
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'Breakfast' }).click()
  await expect(rows).toHaveText(['Overnight oats'])
  await page.getByRole('group', { name: 'Meal' }).getByRole('button', { name: 'All' }).click()
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('lentils')
  await expect(rows).toHaveText(['A simple soup'])
  if (phone) {
    // The meals wrap inside the screen rather than running off it.
    const overflow = await page.evaluate(() => {
      const chips = document.querySelector('.kitchen-chips') as HTMLElement
      return { scroll: chips.scrollWidth, client: chips.clientWidth, page: document.documentElement.scrollWidth - window.innerWidth }
    })
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client)
    expect(overflow.page).toBeLessThanOrEqual(0)
  }

  // A recipe's page reads it and edits it; there is nothing to cook from.
  await page.getByRole('button', { name: /A simple soup/ }).click()
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
