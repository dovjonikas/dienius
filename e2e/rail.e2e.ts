import { expect, test, type Page } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * The rail beside the day - the month, the templates, North, what is next and
 * the day's numbers - fits an ordinary 1080p window without being scrolled,
 * on a plan with more in it than a first week has: five templates and a
 * North text of eight headings, two of them longer than the rail is wide.
 * Where a window is too short for it all, North is what starts folded.
 *
 * Generic names and lines only. The picture this takes is attached to the
 * run, so the rail can be looked at as well as measured.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

const HEADINGS = [
  'WHEN THE DAY STARTS [morning]',
  'THE WORK',
  'THE BODY, AND WHAT IT NEEDS FROM ME ON THE DAYS I WOULD RATHER NOT',
  'PEOPLE',
  'MONEY',
  'THE WEEK',
  'WHAT I DO NOT DO, HOWEVER THE DAY HAS GONE AND WHOEVER ASKS',
  'BEFORE SLEEP [evening]',
]

async function fillThePlan(page: Page): Promise<void> {
  await page.evaluate(headings => {
    const key = 'dienius:data'
    const d = JSON.parse(localStorage.getItem(key) ?? '{}')
    const first = d.templates[0]
    for (const name of ['Second template', 'Third template', 'Fourth template', 'Fifth template']) {
      d.templates.push({ ...first, id: `t-${name}`, name })
    }
    const sections = headings.map((h: string, i: number) => `${h}\na line under heading ${i + 1}\na second line under it`)
    d.picture = {
      text: `A first line of the picture.\nA second line of it.\n\n${sections.join('\n\n')}\n---\nA signature line.`,
      updatedAt: '2026-09-16T08:00:00.000Z',
    }
    localStorage.setItem(key, JSON.stringify(d))
  }, HEADINGS)
  await page.reload()
  await page.locator('.rail').waitFor()
}

test('the rail fits a 1920 by 1080 window with nothing scrolled, North open and every heading on one line', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the rail is the wide layout&apos;s')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
  await fillThePlan(page)

  const rail = page.locator('.rail')
  const fit = await rail.evaluate(el => ({
    scroll: el.scrollHeight,
    client: el.clientHeight,
    bottom: el.getBoundingClientRect().bottom,
    parts: [...el.children].map(c => ({ name: c.className, bottom: c.getBoundingClientRect().bottom })),
  }))
  expect(fit.scroll).toBeLessThanOrEqual(fit.client + 1)
  for (const part of fit.parts) expect(part.bottom, part.name).toBeLessThanOrEqual(fit.bottom + 1)
  expect(fit.parts.map(p => p.name)).toEqual(['mini-calendar', 'template-rail', 'north-day', 'day-digest'])

  // North open, all eight headings there, each on one line, the long ones cut.
  const north = page.getByRole('region', { name: 'North' })
  await expect(north.getByRole('button', { name: 'North', exact: true })).toHaveAttribute('aria-expanded', 'true')
  const headings = north.locator('.north-day-heading')
  await expect(headings).toHaveCount(8)
  const lines = await headings.evaluateAll(els =>
    els.map(el => ({
      tall: el.getBoundingClientRect().height,
      line: parseFloat(getComputedStyle(el).lineHeight),
      cut: el.scrollWidth > el.clientWidth + 1,
    })),
  )
  for (const l of lines) expect(l.tall).toBeLessThan(l.line * 2)
  expect(lines.filter(l => l.cut).length).toBeGreaterThanOrEqual(2)
  // Neither the picture nor the signature stands in the rail.
  await expect(rail).not.toContainText('A signature line.')
  await expect(rail).not.toContainText('A first line of the picture.')

  // A long heading's card opens with the heading whole, and nothing moves.
  const long = north.getByRole('button', { name: /^THE BODY/ })
  const before = await page.locator('.day-digest').boundingBox()
  await long.hover()
  const card = page.locator('.north-heading-card')
  await expect(card.locator('.north-heading-card-heading')).toHaveText(HEADINGS[2])
  await expect(card).toContainText('a line under heading 3')
  expect(await page.locator('.day-digest').boundingBox()).toEqual(before)

  const box = (await rail.boundingBox())!
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: box.x + box.width + 24, height: 1080 } })
  await info.attach('rail at 1920 by 1080', { body: shot, contentType: 'image/png' })
})

test('in a window too short for the whole rail North starts folded, and a press opens it for good on this device', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the rail is the wide layout&apos;s')
  await page.setViewportSize({ width: 1366, height: 768 })
  await openFreshAt(page, wednesdayAt(10))
  await stampWorkingDay(page)
  await fillThePlan(page)

  const fold = page.getByRole('region', { name: 'North' }).getByRole('button', { name: 'North', exact: true })
  await expect(fold).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.north-day-heading')).toHaveCount(0)

  await fold.click()
  await expect(fold).toHaveAttribute('aria-expanded', 'true')
  await page.reload()
  await expect(page.getByRole('region', { name: 'North' }).getByRole('button', { name: 'North', exact: true })).toHaveAttribute('aria-expanded', 'true')
})
