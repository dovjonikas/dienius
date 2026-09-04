import type { Locator, Page } from '@playwright/test'

/**
 * A first open: no plan, no theme, no tour progress. Every test starts here
 * because everything the app does on its own - the starter offer, the tour
 * offer, the weekday template - is keyed on the day being empty.
 */
export async function openFresh(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.getByRole('button', { name: 'Show me around' }).waitFor()
}

/** The one starter template the tour and the smoke test both stamp. */
export async function stampWorkingDay(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Use the Working day template' }).click()
  await page.getByRole('checkbox', { name: 'Get up, shower, coffee' }).waitFor({ state: 'attached' })
}

/** Types a line into quick-add and presses Enter, the ordinary path. */
export async function quickAdd(page: Page, line: string): Promise<void> {
  const box = page.getByPlaceholder('Add a task')
  await box.fill(line)
  await box.press('Enter')
}

/**
 * Ticks a task the way a finger does: on the drawn box beside the title. The
 * real input is visually hidden behind it (see .task input[type='checkbox']
 * in styles.css), so Playwright's own check() finds nothing to aim at.
 */
export async function tick(page: Page, name: string): Promise<void> {
  await box(page.getByRole('checkbox', { name, exact: true })).click()
}

/** Ticks every task on the day that is still open. */
export async function tickEverything(page: Page): Promise<void> {
  // Names first, then one tick per name: each tick re-renders the list and
  // folds the task away, so a locator held across ticks points at nothing.
  const open: string[] = []
  for (const input of await page.getByRole('checkbox').all()) {
    if (!(await input.isChecked())) open.push((await input.getAttribute('aria-label')) ?? '')
  }
  for (const name of open) await tick(page, name)
}

function box(input: Locator): Locator {
  return input.locator('xpath=following-sibling::*[1]')
}
