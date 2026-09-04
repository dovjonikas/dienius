import { expect, test, type Page } from '@playwright/test'

/**
 * The first screen a visitor sees.
 *
 * `?demo=1` is the link on the README, so it is the screen most people will
 * ever see of this app, and for a while it was three banners stacked above
 * a day that started below the fold. Two things are held here: the page
 * itself never scrolls at the wide breakpoint - the day's column takes any
 * overflow, opened at now - and at most one notice sits above the day at a
 * time. The clock is pinned so the sample is the same afternoon every run.
 */

/** 15:00 on a Wednesday, Vilnius time - the same instant scripts/shots.mjs pins. */
const FIXED_TIME = new Date('2026-09-16T12:00:00Z')

test.use({ timezoneId: 'Europe/Vilnius' })

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`the demo opens on a day that fits a ${viewport.width}x${viewport.height} window without scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openDemo(page)

    const scroll = await page.evaluate(() => ({
      tall: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    // The sign, not zero: the root has scrollbar-gutter: stable, so clientWidth
    // is a scrollbar narrower than the window even with nothing to scroll.
    expect(scroll.wide).toBeLessThanOrEqual(0)
    expect(scroll.tall).toBeLessThanOrEqual(0)

    // The afternoon is on screen, not the sleep band the grid starts on.
    const nowLine = page.locator('.timeline-now-line')
    await expect(nowLine).toBeInViewport()
  })
}

test('at most one notice sits above the day', async ({ page }) => {
  await openDemo(page)
  const visible = page.locator('.day-notices > *').filter({ visible: true })
  expect(await visible.count()).toBeLessThanOrEqual(1)
  // The demo line itself is one row, not a card.
  const banner = page.getByRole('status').filter({ hasText: 'Demo data' })
  const height = (await banner.boundingBox())?.height ?? 0
  expect(height).toBeLessThanOrEqual(36)
})

test('the sample afternoon is part-lived: something done, something running, something left', async ({ page }) => {
  await openDemo(page)
  await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Done \d+$/ })).toContainText('6')
  await expect(page.getByRole('checkbox', { name: 'Gym' })).not.toBeChecked()
})

async function openDemo(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME)
  await page.goto('./?demo=1')
  await page.getByRole('status').filter({ hasText: 'Demo data' }).waitFor()
  await page.getByRole('checkbox', { name: 'Draft the launch email' }).waitFor({ state: 'attached' })
  await page.waitForLoadState('networkidle')
}
