import { expect, test } from '@playwright/test'
import { leaveAndReturnAt, openFreshAt, wednesdayAt } from './app'

/**
 * North as a text: written on the page, read as blocks, and the first thing
 * the app opens on in the morning.
 *
 * The jsdom tests hold each piece; what they cannot see is the whole walk
 * on a real screen, and on the phone's screen in particular, since a text
 * read every morning is read on whichever device is in hand. Every line
 * typed here is a generic one: the app carries nobody's text and neither
 * does this test.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('the text is written on the page, reads back whole, and its introduction opens over the day after sleep', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  // A fresh app opens on the day: there is no text to read yet.
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()

  // Nothing written: one line and one button, and no field until asked.
  await expect(page.getByRole('textbox', { name: 'North' })).toHaveCount(0)
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await expect(box).toBeFocused()
  // One question, and nobody's words.
  await expect(box).toHaveAttribute('placeholder', 'Write who you are.')
  // The field is a plain field under its drawing: the browser's own undo
  // takes back what was typed. How much one press takes back is the
  // browser's to decide - Chromium takes a keystroke from a field whose
  // value the page sets - so what is held is that it takes back the end of
  // what was typed and leaves the rest as it was.
  const typed = 'A line to take back'
  await box.pressSequentially(typed)
  await expect(box).toHaveValue(typed)
  await page.keyboard.press('Control+z')
  const undone = await box.inputValue()
  expect(undone.length).toBeLessThan(typed.length)
  expect(typed.startsWith(undone)).toBe(true)
  await box.fill('First line here\nSecond line here\n\nThird line here')
  // Ctrl and Enter is Save.
  await box.press('Control+Enter')
  await expect(page.getByRole('textbox', { name: 'North' })).toHaveCount(0)

  // Read: no heading, so the whole text, the blank line kept as a paragraph break.
  const blocks = page.locator('.north-intro .north-paragraph')
  await expect(blocks).toHaveCount(2)
  await expect(blocks.nth(0)).toHaveText('First line here\nSecond line here')
  await expect(blocks.nth(1)).toHaveText('Third line here')

  // The next morning, after a night away, the app opens on the day with the
  // introduction over it, and Close leaves the day.
  await leaveAndReturnAt(page, wednesdayAt(7 + 24))
  const window = page.getByRole('dialog', { name: 'North' })
  await expect(window).toBeVisible()
  await expect(window.locator('.north-paragraph').first()).toHaveText('First line here\nSecond line here')
  await expect(page.getByPlaceholder('Add a task')).toBeAttached()
  await window.getByRole('button', { name: 'Close' }).click()
  await expect(window).toHaveCount(0)
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()

  // Opened again two hours later, it is the day and nothing over it.
  await leaveAndReturnAt(page, wednesdayAt(9 + 24))
  await expect(page.getByPlaceholder('Add a task')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'North' })).toHaveCount(0)
})

/**
 * A line in capitals is a heading and owns everything to the next one. On
 * the page, since v2.26, all of it is open at rest, on every screen: the
 * introduction, every heading with its lines and the signature, with Edit at
 * the right of the page's name. The jsdom tests hold the parts and the
 * stylesheet; this walks the laid-out page, where the air over a heading and
 * under it can be measured, and then the day, where a heading's lines come
 * when asked: on a hover where there is a pointer, over the day and moving
 * nothing, and on a tap where there is not.
 */
test('the page shows everything at rest with Edit beside its name, and on the day a heading opens on a hover or a tap', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await box.fill('First line here\n\nFIRST HEADING [morning]\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second\n---\na signature line')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // At rest, and nothing asked: every part of the text is on the page.
  await expect(page.locator('.north-intro .north-paragraph')).toHaveText('First line here')
  const headings = page.getByRole('main').getByRole('heading', { level: 3 })
  await expect(headings).toHaveText(['FIRST HEADING', 'SECOND HEADING'])
  const lines = page.locator('.north-section').first().locator('.north-paragraph')
  await expect(lines).toHaveText(['a line under it', 'a second paragraph under it'])
  await expect(lines.nth(1)).toBeVisible()
  await expect(page.locator('.north-section').nth(1).locator('.north-paragraph')).toBeVisible()
  await expect(page.locator('.north-read .north-signature')).toBeVisible()
  await expect(page.locator('.north-read')).not.toContainText('[morning]')
  await expect(page.locator('.north-read').getByRole('button')).toHaveCount(0)

  // Edit at the right of the page's name, on the name's centre, its word on
  // the column's right edge.
  const name = await page.locator('.north-view-title h2').boundingBox()
  const edit = page.getByRole('button', { name: 'Edit', exact: true })
  const editBox = await edit.boundingBox()
  const column = await page.locator('.north-read').boundingBox()
  expect(Math.abs(name!.y + name!.height / 2 - (editBox!.y + editBox!.height / 2))).toBeLessThanOrEqual(1)
  expect(editBox!.x).toBeGreaterThan(name!.x + name!.width)
  const editWordRight = await edit.evaluate(el => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return range.getBoundingClientRect().right
  })
  expect(Math.abs(editWordRight - (column!.x + column!.width))).toBeLessThanOrEqual(2)

  // More air over a heading than under it, measured letter to letter.
  const air = await page.evaluate(() => {
    const ink = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = [...range.getClientRects()]
      return { top: rects[0].top, bottom: rects[rects.length - 1].bottom }
    }
    const second = document.querySelectorAll('.north-section')[1]
    const before = document.querySelectorAll('.north-section')[0].querySelectorAll('.north-paragraph')
    const heading = ink(second.querySelector('.north-heading')!)
    return {
      over: heading.top - ink(before[before.length - 1]).bottom,
      under: ink(second.querySelector('.north-paragraph')!).top - heading.bottom,
    }
  })
  expect(air.over).toBeGreaterThan(air.under * 2)

  // A pointer resting on a heading changes nothing on the page.
  if (info.project.name !== 'phone') {
    const signatureAtRest = await page.locator('.north-read .north-signature').boundingBox()
    await headings.first().hover()
    await page.waitForTimeout(300)
    expect(await page.locator('.north-read .north-signature').boundingBox()).toEqual(signatureAtRest)
    await expect(lines.nth(1)).toBeVisible()
  }

  // And on the day: the headings and the signature, never the introduction.
  // Beside the day on a desktop, where a resting pointer shows a heading's
  // lines on a card beside it and moves nothing; on the phone one folded
  // line that says North - the signature is the day's own line's since
  // v2.26 - a tap opening the headings and a tap on one its card.
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'Today', exact: true }).click()
  const card = page.locator('.north-heading-card .north-paragraph')
  if (info.project.name === 'phone') {
    const north = page.getByRole('group', { name: 'North' })
    await north.getByRole('button', { name: 'North', exact: true }).tap()
    const heading = north.getByRole('button', { name: 'FIRST HEADING' })
    await heading.tap()
    await expect(card).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(card.nth(1)).toBeInViewport()
    await heading.tap()
    await expect(card).toHaveCount(0)
  } else {
    const north = page.getByRole('region', { name: 'North' })
    await expect(north.getByText('a signature line')).toBeVisible()
    await expect(card).toHaveCount(0)
    const next = page.locator('.rail > .north-day ~ *').first()
    const nextAtRest = await next.boundingBox()
    const heading = north.getByRole('button', { name: 'FIRST HEADING' })
    await heading.hover()
    await expect(card).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(card.nth(1)).toBeInViewport()
    // Beside the heading, over the day, and nothing in the rail moved.
    const at = await heading.boundingBox()
    const cardBox = await page.locator('.north-heading-card').boundingBox()
    expect(cardBox!.x).toBeGreaterThan(at!.x + at!.width)
    expect(await next.boundingBox()).toEqual(nextAtRest)
    await page.mouse.move(700, 5)
    await expect(card).toHaveCount(0)
  }
  await expect(page.getByText('First line here')).toHaveCount(0)
})

/**
 * The field's own text is transparent and a drawing of it stands under it,
 * so every line of the drawing has to end exactly where the field's line
 * ends - a heading drawn heavier with its tag drawn quieter, the mark drawn
 * as a rule and a long line wrapped across three included. The field's line
 * ends are read from a copy of the field holding the text up to that line,
 * which is the only way to ask a browser where a textarea's line is.
 */
test('what is typed and the drawing under it stand on the same lines, long wrapped lines too', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  const long = 'a long line that goes on past the width of the page and keeps going, so that it has to wrap onto a second line and then onto a third one before it stops'
  await box.fill(['a first line', long, '', 'FIRST HEADING [evening]', long, '---', 'A SIGNATURE IN CAPITALS', long].join('\n'))

  const drift = await page.evaluate(() => {
    const field = document.querySelector('.north-editor-text') as HTMLTextAreaElement
    const drawing = document.querySelector('.north-editor-mirror') as HTMLElement
    const lines = [...drawing.querySelectorAll('.north-editor-line')] as HTMLElement[]
    const top = drawing.getBoundingClientRect().top
    const probe = field.cloneNode() as HTMLTextAreaElement
    probe.removeAttribute('aria-describedby')
    probe.style.cssText = `position: absolute; visibility: hidden; inset: auto; height: 0; min-height: 0; width: ${field.clientWidth}px`
    field.parentElement!.appendChild(probe)
    // Where each line ends in the field, and where its drawing's last line
    // of letters ends. A span's box is its letters' height, a line's
    // leading short of the line, so what has to hold is that the difference
    // is the same on every line - a drawing that pushed one line down would
    // push every line after it. The mark is an inline block the height of
    // its whole line and is measured through the lines after it.
    const ends = lines.map((line, i) => {
      probe.value = field.value.split('\n').slice(0, i + 1).join('\n')
      const rects = line.getClientRects()
      return {
        field: probe.scrollHeight,
        drawn: rects.length ? rects[rects.length - 1].bottom - top : NaN,
        measured: !line.classList.contains('is-mark') && line.textContent !== '',
      }
    })
    probe.remove()
    const measured = ends.filter(end => end.measured)
    const leading = measured[0].field - measured[0].drawn
    const worst = Math.max(...measured.map(end => Math.abs(end.field - end.drawn - leading)))
    return { worst, lines: lines.length, measured: measured.length }
  })
  expect(drift.lines).toBe(8)
  expect(drift.measured).toBe(6)
  expect(drift.worst).toBeLessThanOrEqual(1)
})
