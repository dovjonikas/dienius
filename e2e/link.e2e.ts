import { expect, test } from '@playwright/test'
import { card, openFreshAt, quickAdd, wednesdayAt } from './app'

/**
 * The door to the thing a task is about, walked in a browser.
 *
 * Three of the promises here cannot be seen at the jsdom level: that the
 * bubble with the address sits under the control rather than on it
 * (CONVENTIONS section 24), that the control keeps its 44px on a phone, and
 * that pressing it opens a second tab rather than taking this one somewhere.
 * The last is the one the owner asked for by name - Dienius never closes.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

test('a link on a task opens a second tab, and its bubble sits under the icon', async ({ page, context }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Spanish')

  await card(page, 'Spanish').getByRole('button', { name: /^More actions for Spanish/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  // The preview's own address, which is a machine of this person's own and,
  // unlike a made-up port, is actually answering - so the tab that opens
  // lands on a page rather than on the browser's error screen and the test
  // can say where it went.
  const here = new URL(page.url())
  const target = `${here.host}/dienius/?opened-from-a-task`
  await sheet.getByLabel('Link (optional)').fill(target)
  await sheet.getByLabel('Link (optional)').blur()
  await sheet.getByRole('button', { name: 'Done' }).click()

  const door = page.getByRole('link', { name: /Open Spanish at localhost/ })
  await expect(door).toBeVisible()

  // The bubble is under the control, never on it. Measured rather than
  // asserted from the markup: the whole rule is about pixels.
  await door.hover()
  const bubble = page.locator('.tip').first()
  await expect(bubble).toBeVisible()
  const iconBox = await door.boundingBox()
  const bubbleBox = await bubble.boundingBox()
  if (!iconBox || !bubbleBox) throw new Error('the door or its bubble is not on the screen')
  expect(bubbleBox.y).toBeGreaterThanOrEqual(iconBox.y + iconBox.height - 1)

  // And the press opens a tab rather than leaving this one.
  const opened = context.waitForEvent('page')
  await door.click({ modifiers: [] })
  const second = await opened
  expect(second.url()).toContain('opened-from-a-task')
  // And this one is exactly where it was. Dienius never closes.
  expect(page.url()).toContain('/dienius/')
  expect(page.url()).not.toContain('opened-from-a-task')
  await expect(page.getByRole('checkbox', { name: 'Spanish' })).toBeAttached()
  await second.close()
})

test('the door keeps its target on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Spanish')

  await card(page, 'Spanish').getByRole('button', { name: /^More actions for Spanish/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Link (optional)').fill('example.com/spanish')
  await sheet.getByLabel('Link (optional)').blur()
  await sheet.getByRole('button', { name: 'Done' }).click()

  const box = await page.getByRole('link', { name: /Open Spanish at example.com/ }).boundingBox()
  if (!box) throw new Error('the door is not on the screen')
  // The app's own minimum, CONVENTIONS section 9.
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
})

test('the door is on the title line, and pressing it does not open the editor', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Spanish')

  await card(page, 'Spanish').getByRole('button', { name: /^More actions for Spanish/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  // Without a scheme, which is what somebody actually types.
  await sheet.getByLabel('Link (optional)').fill('localhost:8080/spanish')
  await sheet.getByLabel('Link (optional)').blur()
  await sheet.getByRole('button', { name: 'Done' }).click()

  const stored = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') || '{}')
    return Object.values(data.days as Record<string, { tasks: { link?: string }[] }>)[0]?.tasks[0]?.link
  })
  expect(stored).toBe('http://localhost:8080/spanish')

  // On the title's line, not among the marks under it.
  const door = card(page, 'Spanish').getByRole('link', { name: /Open Spanish at localhost/ })
  const inTitle = await door.evaluate(el => Boolean(el.closest('.task-title-line')))
  expect(inTitle).toBe(true)
  expect(await card(page, 'Spanish').locator('.task-meta .task-link').count()).toBe(0)

  // And pressing it opens the address, not the task. The icon sits inside
  // the check box's own <label>, so this is two promises: no editor, and no
  // tick either - a press that quietly finished the task would be the worst
  // of the three things this could do.
  const opened = page.waitForEvent('popup')
  await door.click()
  await (await opened).close()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Spanish' })).not.toBeChecked()
})

/**
 * The door reads as a mark beside the title, not as the last letter of it.
 *
 * Every number here is against the title's own type rather than in pixels,
 * which is the whole of what changed in v2.14: the icon was 1.15em of the
 * card's 13px - a 15px icon beside 15px letters - centred on the x-height of
 * a size the line it sits on does not contain, with a plain space for a gap.
 * Measured in a browser because none of it exists in jsdom.
 */
test('the door is three quarters of the title, in the meta ink, off its last word', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, '09:00 Spanish')

  await card(page, 'Spanish').getByRole('button', { name: /^More actions for Spanish/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Link (optional)').fill('example.com/spanish')
  await sheet.getByLabel('Link (optional)').blur()
  await sheet.getByRole('button', { name: 'Done' }).click()

  const read = await card(page, 'Spanish').evaluate(el => {
    const a = el.querySelector('.task-link') as HTMLElement
    const svg = a.querySelector('svg') as SVGElement
    const title = el.querySelector('.task-title') as HTMLElement
    const time = el.querySelector('.task-time') as HTMLElement
    const size = parseFloat(getComputedStyle(title).fontSize)
    const range = document.createRange()
    range.selectNodeContents(title)
    const rects = [...range.getClientRects()]
    const last = rects[rects.length - 1]
    const sr = svg.getBoundingClientRect()
    return {
      titleSize: size,
      iconSize: sr.width,
      gap: sr.left - last.right,
      iconInk: getComputedStyle(a).color,
      metaInk: getComputedStyle(time).color,
      titleInk: getComputedStyle(title).color,
    }
  })

  // Three quarters of the title, and 0.4em off its last word.
  expect(read.iconSize).toBeCloseTo(read.titleSize * 0.75, 1)
  expect(read.gap).toBeCloseTo(read.titleSize * 0.4, 1)
  // The ink of the line under it, not the ink of the title beside it.
  expect(read.iconInk).toBe(read.metaInk)
  expect(read.iconInk).not.toBe(read.titleInk)
})

test('an address this cannot open says so instead of saving nothing', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await quickAdd(page, 'Spanish')

  await card(page, 'Spanish').getByRole('button', { name: /^More actions for Spanish/ }).click()
  await page.getByRole('button', { name: /Details/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Link (optional)').fill('not an address')
  await sheet.getByLabel('Link (optional)').blur()

  await expect(sheet.getByText(/not an address this can open/i)).toBeVisible()
  // Typing again takes the message away rather than leaving it under a field
  // somebody is already fixing.
  await sheet.getByLabel('Link (optional)').fill('localhost:8080')
  await expect(sheet.getByText(/not an address this can open/i)).toHaveCount(0)
})
