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

/**
 * The grid's boxes keep to the layout's. A gap stands on the pixels the
 * layout gave it and never over the block under it, and a long block's two
 * lines - its title and its times - are whole. Found on 2026-10-06 in the
 * README's own pictures: every gap carried a 44px minimum written for a
 * finger while the layout had reserved 28px for a mouse, so each gap's box
 * ran into the block under it and the leading gap's label stood under the
 * first block's title; and one look's spacing tokens had made a two-line
 * block need more than its 48px floor, so both lines shrank and lost their
 * descenders on every hour-long block. The sweep sees neither: a gap's label
 * is hidden from readers, and a shrunken line ends in an ellipsis, which it
 * takes as shortened on purpose.
 */
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`no gap stands over a block and no line of a block is shorter than its text at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openDemo(page)
    const found = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect()
      const anchors = [...document.querySelectorAll('.timeline-anchor')]
      const over: string[] = []
      for (const gap of document.querySelectorAll('.timeline-gap')) {
        const g = box(gap)
        for (const anchor of anchors) {
          const b = box(anchor)
          const y = Math.min(g.bottom, b.bottom) - Math.max(g.top, b.top)
          const x = Math.min(g.right, b.right) - Math.max(g.left, b.left)
          if (y > 1 && x > 0) over.push(`${gap.textContent?.trim()} over ${anchor.textContent?.trim().slice(0, 24)} by ${Math.round(y)}px`)
        }
      }
      const cut: string[] = []
      for (const line of document.querySelectorAll<HTMLElement>('.timeline-anchor-title, .timeline-anchor-time')) {
        if (line.scrollHeight > line.clientHeight + 1) cut.push(`${line.textContent?.trim().slice(0, 24)}: ${line.clientHeight} of ${line.scrollHeight}px`)
      }
      return { over, cut }
    })
    expect(found.over, 'no gap stands over a block').toEqual([])
    expect(found.cut, 'no line of a block is shorter than its text').toEqual([])
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
