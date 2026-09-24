import { expect, test } from '@playwright/test'
import { openFreshAt, quickAdd, tick, wednesdayAt } from './app'

/**
 * Two tabs of the app open at once on one device - the owner's shift brief
 * of 2026-09-25, stage 7. Each tab keeps the plan in memory and saves it
 * whole; until this, a tab left open behind another saved its older copy
 * over the other's change the next time anything was written in it. The
 * tick made in one tab has to survive a change made in the other, and both
 * tabs have to end up saying the same. Every title is invented.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a tick in one tab survives a change in the other, and both tabs end up with both', async ({ context, page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Call the bank')
  await quickAdd(page, 'Water the plants')

  // A second tab of the same app, opened on the same plan.
  const other = await context.newPage()
  await other.clock.setFixedTime(wednesdayAt(10, 1))
  await other.goto('./')
  await expect(other.getByRole('checkbox', { name: 'Water the plants', exact: true })).toBeAttached()

  // The first tab ticks the bank; the second, open all along, ticks the plants.
  await tick(page, 'Call the bank')
  await tick(other, 'Water the plants')

  // Neither tick is lost - in what is saved, and on either screen.
  const saved = await other.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}') as { days: Record<string, { tasks: { title: string; done: boolean }[] }> }
    return Object.values(data.days).flatMap(d => d.tasks.filter(t => t.done).map(t => t.title)).sort()
  })
  expect(saved).toEqual(['Call the bank', 'Water the plants'])
  // Both ticked tasks are under Done on each screen: the first tab took in the second's tick by itself.
  await expect(page.getByRole('button', { name: /^Done 2/ })).toBeVisible()
  await expect(other.getByRole('button', { name: /^Done 2/ })).toBeVisible()
})

test('an erase in one tab is followed by the other, which does not put the plan back', async ({ context, page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Call the bank')
  const other = await context.newPage()
  await other.clock.setFixedTime(wednesdayAt(10, 1))
  await other.goto('./')
  await expect(other.getByRole('checkbox', { name: 'Call the bank', exact: true })).toBeAttached()

  // The first tab erases this device.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Erase all data' }).click()
  await page.getByRole('button', { name: 'Erase?' }).click()
  await page.getByRole('button', { name: 'Take the tour' }).waitFor()

  // The other tab starts afresh with it, and writes nothing back - not even
  // when something is written in it afterwards.
  await other.getByRole('button', { name: 'Take the tour' }).waitFor()
  await expect(other.getByRole('checkbox', { name: 'Call the bank', exact: true })).toHaveCount(0)
  await quickAdd(other, 'After the erase')
  const titles = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{"days":{}}') as { days: Record<string, { tasks: { title: string }[] }> }
    return Object.values(data.days).flatMap(d => d.tasks.map(t => t.title))
  })
  expect(titles).toEqual(['After the erase'])
})
