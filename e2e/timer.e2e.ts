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

/** Opens the timer panel, unfolds the sound block, and chooses one of the four. */
async function chooseSound(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  const head = page.getByRole('button', { name: /^Sound/ })
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click()
  await page.getByRole('group', { name: 'Sound' }).getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('group', { name: 'Sound' }).getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
}

/** Picks a length and starts it - two presses since v2.15, one control each. */
async function startTimer(page: import('@playwright/test').Page, minutes: number) {
  await page.getByRole('button', { name: `${minutes} min`, exact: true }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
}

test('the alarm keeps going, and Escape ends it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await page.addInitScript(WATCH_AUDIO)
  await openFresh(page)

  await chooseSound(page, 'Alarm')
  // Every press so far is a user gesture, which is what a browser wants
  // before it will open an AudioContext at all - see hasSeenAGesture.
  await startTimer(page, 5)

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
  await startTimer(page, 5)
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
  await startTimer(page, 5)

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

  await startTimer(page, 5)
  await page.clock.runFor('05:01')

  await expect(page.getByText('Timer finished')).toBeVisible()
  expect((await audio(page)).contexts).toBe(0)
})

/**
 * The stopwatch writes down what actually took how long.
 *
 * Every block in this app has had a planned length since v1.0 and not one has
 * had a real one, so "where the plan and the week disagreed" has had to be
 * read off when things happened rather than off how long they took. This is
 * the only path that writes one, and every step of it is a press: nothing
 * measures anything on its own.
 */
test('a stopwatch started on a task records what it took, and the number survives a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await openFresh(page)

  const box = page.getByPlaceholder('Add a task')
  await box.fill('Write the letter')
  await box.press('Enter')

  await page.getByRole('button', { name: /^More actions for Write the letter/ }).click()
  await page.getByRole('button', { name: 'Time this' }).click()

  // The floating widget takes over, as it does for every clock in this app.
  await expect(page.getByRole('status', { name: 'Stopwatch' })).toBeVisible()

  await page.clock.fastForward('52:00')
  await page.getByRole('status', { name: 'Stopwatch' }).getByRole('button', { name: 'Pause' }).click()

  // The offer, in the panel where the stopwatch lives. One line, and walking
  // away from it is a complete answer.
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  const offer = page.getByText(/Write the letter took/)
  await expect(offer).toBeVisible()
  await expect(page.getByText(/Planned 30/)).toBeVisible()

  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(page.getByText('Written down')).toBeVisible()
  await page.keyboard.press('Escape')

  // On the card, beside the length it was planned at, and only because the
  // two disagree.
  await expect(page.getByText('52 min actual')).toBeVisible()

  await page.reload()
  await expect(page.getByText('52 min actual')).toBeVisible()
})

test('a stopwatch on nothing behaves exactly as it always did', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await openFresh(page)

  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  await page.getByRole('button', { name: 'Stopwatch', exact: true }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()

  await page.clock.fastForward('01:00')
  await page.getByRole('status', { name: 'Stopwatch' }).getByRole('button', { name: 'Pause' }).click()

  // Nothing to record, because it was not measuring anything - sometimes you
  // are timing how long the pasta takes.
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Reset', exact: true })).toBeVisible()
})

test('walking away from the offer leaves the day as it was', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00') })
  await openFresh(page)

  const box = page.getByPlaceholder('Add a task')
  await box.fill('Write the letter')
  await box.press('Enter')

  await page.getByRole('button', { name: /^More actions for Write the letter/ }).click()
  await page.getByRole('button', { name: 'Time this' }).click()
  await page.clock.fastForward('52:00')
  await page.getByRole('status', { name: 'Stopwatch' }).getByRole('button', { name: 'Pause' }).click()

  // Reset without recording is still Reset. Nothing is asked twice.
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('button', { name: 'Record', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.keyboard.press('Escape')

  await expect(page.getByText(/actual/)).toHaveCount(0)
})

/**
 * The panel, as a panel: what it says folded, and that it always has an
 * answer in it.
 *
 * The layout rules are CONVENTIONS 16 (a control opens holding an answer),
 * 23 (a thing is said once) and 25 (a state earns its place). What they come
 * to here is that the sound is one line until somebody wants it, that the
 * line says what is set rather than that a setting exists, and that Start is
 * never a button that looks broken.
 */
test('the panel folds its sound down to one line that says what is set', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()

  // Folded, and the fold is not hiding the answer.
  const head = page.getByRole('button', { name: /^Sound/ })
  await expect(head).toHaveAttribute('aria-expanded', 'false')
  await expect(head).toContainText('Soft, medium')
  await expect(page.getByRole('group', { name: 'Sound' })).toHaveCount(0)

  await head.click()
  await page.getByRole('group', { name: 'Sound' }).getByRole('button', { name: 'Alarm', exact: true }).click()
  await page.getByLabel('How loud').fill('1')
  await expect(head).toContainText('Alarm, loud')

  // Off has no volume worth saying, and nothing left to control.
  await page.getByRole('group', { name: 'Sound' }).getByRole('button', { name: 'Off', exact: true }).click()
  await expect(head).toContainText('Off')
  await expect(head).not.toContainText(',')
  await expect(page.getByLabel('How loud')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try', exact: true })).toHaveCount(0)
})

test('the length field opens holding an answer, and a chip changes it', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()

  const field = page.getByRole('textbox', { name: 'Custom timer length in minutes' })
  await expect(field).toHaveValue('10')
  await expect(page.getByRole('button', { name: '10 min', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // Never disabled: the field always holds something, so there is no state
  // in which this cannot start a timer.
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled()

  await page.getByRole('button', { name: '15 min', exact: true }).click()
  await expect(field).toHaveValue('15')
  await expect(page.getByRole('button', { name: '15 min', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '10 min', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Timer' })).toBeVisible()

  // And the panel opens on it next time, so the ordinary case stays one press.
  await page.getByRole('button', { name: 'Timer and stopwatch' }).click()
  await expect(page.getByRole('textbox', { name: 'Custom timer length in minutes' })).toHaveValue('15')
})
