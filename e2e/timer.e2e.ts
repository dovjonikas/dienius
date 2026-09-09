import { expect, test } from '@playwright/test'
import { openFresh } from './app'

/**
 * The alarm, and the way out of it.
 *
 * Three of the four sounds are over in a second and look after themselves.
 * The alarm repeats for a minute so that it can be heard from another room,
 * which makes it the one sound in this app that can happen *to* somebody -
 * and a sound like that has to be endable from wherever they are standing.
 *
 * Walked in a browser because none of it exists in jsdom: there is no
 * `AudioContext` there, and the whole question is what one was asked to do.
 * The context is wrapped before the page loads so the test can count what was
 * scheduled and see it stopped, rather than asserting on a button and hoping.
 *
 * It never waits a real minute. The alarm is *scheduled* a minute ahead in one
 * go - see the note on the audio clock in lib/chime.ts - so everything worth
 * asserting is true the instant it starts.
 */
test.use({ timezoneId: 'Europe/Vilnius' })

/** Records every oscillator asked for, and every stop, on `window.__audio`. */
const WATCH_AUDIO = `
  window.__audio = { oscillators: 0, stops: 0, contexts: 0 }
  const Real = window.AudioContext
  window.AudioContext = class extends Real {
    constructor(...args) {
      super(...args)
      window.__audio.contexts += 1
    }
    createOscillator() {
      window.__audio.oscillators += 1
      const osc = super.createOscillator()
      const stop = osc.stop.bind(osc)
      osc.stop = (...a) => { window.__audio.stops += 1; return stop(...a) }
      return osc
    }
  }
`

async function audio(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as unknown as { __audio: { oscillators: number; stops: number; contexts: number } }).__audio)
}

/** Opens the timer panel and chooses one of the four sounds. */
async function chooseSound(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  await page.getByRole('group', { name: 'Sound' }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('group', { name: 'Sound' }).getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

test('the alarm keeps going, and Escape ends it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await page.addInitScript(WATCH_AUDIO)
  await openFresh(page)

  await chooseSound(page, 'Alarm')
  // Every press so far is a user gesture, which is what a browser wants
  // before it will open an AudioContext at all - see hasSeenAGesture.
  await page.getByRole('button', { name: '5 min', exact: true }).click()

  const before = await audio(page)
  await page.clock.runFor('05:01')

  // It rang, and it rang more than once: three tones a round, twenty rounds
  // scheduled up front, so anything past three is a sound that repeats.
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(3)
  expect((await audio(page)).contexts).toBeGreaterThan(before.contexts)

  // And the way out is drawn, in words, without hovering anything.
  const stop = page.getByRole('button', { name: 'Stop', exact: true })
  await expect(stop).toBeVisible()

  const ringing = await audio(page)
  await page.keyboard.press('Escape')

  await expect(stop).toHaveCount(0)
  // Everything that was scheduled has been told to stop, which is what
  // silence is when the whole minute was queued in advance.
  await expect.poll(async () => (await audio(page)).stops).toBeGreaterThanOrEqual(ringing.oscillators)
})

test('the quiet chime needs no way out, and does not draw one', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await page.addInitScript(WATCH_AUDIO)
  await openFresh(page)

  await chooseSound(page, 'Soft')
  await page.getByRole('button', { name: '5 min', exact: true }).click()
  await page.clock.runFor('05:01')

  await expect(page.getByText('Timer finished')).toBeVisible()
  // Two tones and then silence: there is nothing for a Stop button to do.
  await expect.poll(async () => (await audio(page)).oscillators).toBe(2)
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
  // The way to be rid of the finished state is the one it always was.
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible()
})

test('the start bell rings on the press, and an alarm starts as a bell', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await page.addInitScript(WATCH_AUDIO)
  await openFresh(page)

  await chooseSound(page, 'Alarm')
  // The real control is hidden behind the box the app paints for it, so the
  // press lands on the words - the same thing a finger does.
  await page.getByText('Ring at the start too').click()
  await expect(page.getByRole('checkbox', { name: 'Ring at the start too' })).toBeChecked()

  const before = await audio(page)
  await page.getByRole('button', { name: '5 min', exact: true }).click()

  // Two tones, not three rising ones twenty times over: an alarm at the
  // moment somebody presses Start is being played to the person pressing it.
  await expect.poll(async () => (await audio(page)).oscillators - before.oscillators).toBe(2)
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
})

test('Off makes no sound at all, and hides what it does not control', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await page.addInitScript(WATCH_AUDIO)
  await openFresh(page)

  await chooseSound(page, 'Off')
  await expect(page.getByRole('button', { name: 'Try', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('How loud')).toHaveCount(0)

  await page.getByRole('button', { name: '5 min', exact: true }).click()
  await page.clock.runFor('05:01')

  await expect(page.getByText('Timer finished')).toBeVisible()
  expect((await audio(page)).contexts).toBe(0)
})
