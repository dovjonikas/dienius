import { expect, test } from '@playwright/test'
import { openFreshAt, quickAdd, stampWorkingDay, wednesdayAt } from './app'

/**
 * Resting on a day in the month says what is on it - see DayPeek.tsx.
 *
 * This is a browser test rather than a unit one because every promise it
 * holds is geometry or timing: that nothing under the layer moves when it
 * appears, that it never covers the day it is about, that sweeping a week
 * shows nothing at all, and that the keyboard gets the same thing the
 * pointer does. jsdom has none of those.
 *
 * The one that matters most is the sweep. The hover card this replaces was
 * removed in v2.8 for being unreachable; the failure this one is built
 * against is the other one - a layer that blinks on and off seven times
 * while somebody moves the mouse across the month on their way somewhere
 * else.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

const PEEK = '.day-peek'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
  await quickAdd(page, '11:00 Ring the bank 15min')
  await page.getByRole('navigation').getByRole('button', { name: 'Calendar' }).click()
  await page.getByRole('grid').waitFor()
})

/**
 * How many times a peek has been *added to the page*, which is the only
 * honest way to ask about flicker.
 *
 * Asserting a locator's count right after a move proves nothing: the layer is
 * absent for a quarter second by design, so "not there yet" always passes,
 * and `toHaveCount` retries until it is there, so "there eventually" always
 * passes too. Counting the additions catches both the layer that should never
 * have opened and the layer that closed and reopened between two neighbours.
 */
async function watchPeek(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __peekAdds: number }
    w.__peekAdds = 0
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains('day-peek')) w.__peekAdds++
        }
      }
    }).observe(document.body, { childList: true, subtree: true })
  })
}

function peekAdds(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as unknown as { __peekAdds: number }).__peekAdds)
}

/** The seven cells of the week today is in, left to right. */
async function weekCells(page: import('@playwright/test').Page) {
  const cells = page.getByRole('gridcell')
  const today = await page.locator('[aria-current="date"]').boundingBox()
  const boxes = []
  for (const cell of await cells.all()) {
    const box = await cell.boundingBox()
    if (box && today && Math.abs(box.y - today.y) < 2) boxes.push(box)
  }
  return boxes
}

test('resting on a day says what is on it, and moves nothing under it', async ({ page }) => {
  const grid = page.getByRole('grid')
  const before = await grid.boundingBox()
  const today = page.locator('[aria-current="date"]')
  const cell = await today.boundingBox()

  await today.hover()
  await expect(page.locator(PEEK)).toBeVisible()
  await expect(page.locator(PEEK)).toContainText('Working day')
  await expect(page.locator(PEEK)).toContainText('tasks')

  // Nothing under it moved by a pixel. CONVENTIONS 24 is about layout
  // shifting, and a fixed layer over the top is not that.
  expect(await grid.boundingBox()).toEqual(before)

  // And it is not standing on the day it is describing.
  const peek = await page.locator(PEEK).boundingBox()
  const apart =
    peek!.x + peek!.width <= cell!.x + 1 ||
    cell!.x + cell!.width <= peek!.x + 1 ||
    peek!.y + peek!.height <= cell!.y + 1 ||
    cell!.y + cell!.height <= peek!.y + 1
  expect(apart).toBe(true)
})

test('crossing the week on the way somewhere shows nothing at all', async ({ page }) => {
  const boxes = await weekCells(page)
  expect(boxes.length).toBe(7)
  await watchPeek(page)

  // Monday to Sunday without stopping on any of them, and off the month at
  // the end. Each cell entered restarts the wait, so what decides this is
  // the longest pause on one day rather than how long the sweep takes.
  let last = Date.now()
  let longest = 0
  for (const box of boxes) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    longest = Math.max(longest, Date.now() - last)
    last = Date.now()
  }
  await page.mouse.move(4, 4)
  longest = Math.max(longest, Date.now() - last)

  expect(await peekAdds(page)).toBe(0)
  // And the zero above meant something. A runner busy enough to leave the
  // pointer on one day for longer than the app waits has turned this sweep
  // into a rest, and a rest is supposed to open it - so the test says the
  // machine was too slow rather than that the app was wrong.
  expect(longest, 'the sweep rested on a day longer than the delay').toBeLessThan(250)
})

test('once it is open, walking to the next day swaps it in place rather than blinking', async ({ page }) => {
  const boxes = await weekCells(page)
  await page.mouse.move(boxes[0].x + boxes[0].width / 2, boxes[0].y + boxes[0].height / 2)
  await expect(page.locator(PEEK)).toBeVisible()

  // Counting from here, with the first one already open and long dwells on
  // each of the six after it. A layer that closed on the way out of a cell
  // and opened again on the way into the next would add six.
  await watchPeek(page)
  for (const box of boxes.slice(1)) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(300)
    await expect(page.locator(PEEK)).toHaveCount(1)
  }

  expect(await peekAdds(page)).toBe(0)
})

test('leaving the month takes it away at once', async ({ page }) => {
  const today = page.locator('[aria-current="date"]')
  await today.hover()
  await expect(page.locator(PEEK)).toBeVisible()

  await page.mouse.move(4, 4)
  await expect(page.locator(PEEK)).toHaveCount(0)
})

test('the keyboard is shown the same thing the pointer is, and without the wait', async ({ page }) => {
  const today = page.locator('[aria-current="date"]')
  await today.hover()
  const hovered = await page.locator(PEEK).innerText()
  await page.mouse.move(4, 4)
  await expect(page.locator(PEEK)).toHaveCount(0)

  await today.focus()
  await expect(page.locator(PEEK)).toBeVisible()
  expect(await page.locator(PEEK).innerText()).toBe(hovered)

  // An arrow walks the grid, and the layer walks with it.
  await page.keyboard.press('ArrowRight')
  await expect(page.locator(PEEK)).toHaveCount(1)
  expect(await page.locator(PEEK).innerText()).not.toBe(hovered)
})

test('a press opens the day, and the layer is gone rather than under the card', async ({ page }) => {
  const today = page.locator('[aria-current="date"]')
  await today.hover()
  await expect(page.locator(PEEK)).toBeVisible()

  await today.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator(PEEK)).toHaveCount(0)
})

test('a template in hand turns every cell into a brush, and nothing explains the day under it', async ({ page }) => {
  await page.getByRole('button', { name: /Working day/ }).first().click()
  const today = page.locator('[aria-current="date"]')
  await today.hover()
  await expect(page.locator(PEEK)).toHaveCount(0)
})
