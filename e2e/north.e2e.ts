import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

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

/**
 * Closing the app and opening it again later. The page is left before the
 * clock moves, the way a night is - closed at ten, opened at seven - since
 * leaving view is the moment the app writes as the start of a break.
 */
async function leaveAndReturnAt(page: Page, time: Date): Promise<void> {
  await page.goto('about:blank')
  await page.clock.setFixedTime(time)
  await page.goto('./')
  await page.getByRole('navigation').first().waitFor()
}

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
 * A line in capitals is a heading and owns everything to the next one, and
 * what it holds comes when asked: on a hover where there is a pointer, over
 * the page and moving nothing, and on a tap where there is not. The jsdom
 * tests hold the state; this is the one place the two ways of asking are
 * walked on the screens that have them.
 */
test('a heading opens on a hover without moving the page, or on a tap where there is no pointer, and closes again', async ({ page }, info) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  await box.fill('First line here\n\nFIRST HEADING\na line under it\n\na second paragraph under it\nSECOND HEADING\na line under the second\n---\na signature line')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // At rest: the introduction, the two headings, and nothing under them.
  await expect(page.locator('.north-intro .north-paragraph')).toHaveText('First line here')
  const first = page.getByRole('button', { name: 'FIRST HEADING' })
  const second = page.getByRole('button', { name: 'SECOND HEADING' })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  const lines = page.locator('.north-section').first().locator('.north-paragraph')
  await expect(lines.first()).toBeHidden()

  if (info.project.name === 'phone') {
    await first.tap()
    await expect(lines).toHaveText(['a line under it', 'a second paragraph under it'])
    await expect(lines.nth(1)).toBeVisible()
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    await first.tap()
    await expect(lines.first()).toBeHidden()
  } else {
    const edit = page.getByRole('button', { name: 'Edit', exact: true })
    const editAtRest = await edit.boundingBox()
    await first.hover()
    await expect(lines.nth(1)).toBeVisible()
    await expect(lines).toHaveText(['a line under it', 'a second paragraph under it'])
    // Nothing on the page moved to make the room (CONVENTIONS 24).
    expect(await edit.boundingBox()).toEqual(editAtRest)
    // Down to where the second heading is drawn, and its words take over.
    const at = await second.boundingBox()
    await page.mouse.move((at?.x ?? 0) + 20, (at?.y ?? 0) + (at?.height ?? 0) / 2, { steps: 5 })
    await expect(lines.first()).toBeHidden()
    await expect(page.locator('.north-section').nth(1).locator('.north-paragraph')).toBeVisible()
    // Away, and it is gone: a hover pins nothing.
    await page.mouse.move(5, 5)
    await expect(page.locator('.north-section').nth(1).locator('.north-paragraph')).toBeHidden()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
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
 * ends - a heading drawn heavier, the mark drawn as a rule and a long line
 * wrapped across three included. The field's line ends are read from a
 * copy of the field holding the text up to that line, which is the only
 * way to ask a browser where a textarea's line is.
 */
test('what is typed and the drawing under it stand on the same lines, long wrapped lines too', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
  await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: 'North', exact: true }).click()
  await page.getByRole('main').getByRole('button', { name: 'Write', exact: true }).click()
  const box = page.getByRole('textbox', { name: 'North' })
  const long = 'a long line that goes on past the width of the page and keeps going, so that it has to wrap onto a second line and then onto a third one before it stops'
  await box.fill(['a first line', long, '', 'FIRST HEADING', long, '---', 'A SIGNATURE IN CAPITALS', long].join('\n'))

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
