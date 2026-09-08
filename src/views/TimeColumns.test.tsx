import { expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeColumns } from './TimeColumns'
import type { TakenBlock } from './takenHours'

/**
 * The two columns, given a day to speak about.
 *
 * The arithmetic is `takenHours.ts` and is tested there. What is worth holding
 * here is everything a person actually meets: that a taken hour says so in
 * words as well as in colour, that the colour genuinely reaches the option,
 * that nothing is ever refused, and that a caller with no day behind it gets
 * exactly the control it had before any of this.
 */

function hours() {
  return within(screen.getByRole('listbox', { name: 'Hour' }))
}

const NINE_TO_TEN: TakenBlock[] = [{ start: 540, end: 600, color: 'var(--cat-core)', label: 'Deep work' }]

test('an hour a block covers says so in words, so colour is never the only way it is said', () => {
  render(<TimeColumns value="" onPick={() => {}} taken={NINE_TO_TEN} />)
  expect(hours().getByRole('option', { name: '09, taken by Deep work' })).toBeInTheDocument()
})

test('an hour covered in part says how much of it is gone rather than all of it', () => {
  render(<TimeColumns value="" onPick={() => {}} taken={[{ start: 750, end: 780, label: 'Meals' }]} />)
  expect(hours().getByRole('option', { name: '12, 30 min taken by Meals' })).toBeInTheDocument()
})

/**
 * No category colour reaches the column any more, and no share of an hour
 * either.
 *
 * The wash and the bar under the numeral said what the timeline says, less
 * well: an hour is a box of sixty minutes, so a block from 09:05 to 10:05
 * painted nine and ten identically and the column looked precise while
 * rounding in both directions. What is left is one class - the stylesheet
 * draws a 2px rule in the border's own grey off it - and the words. Held
 * here because a colour creeping back into these options is exactly the kind
 * of thing that reads as an improvement while it is being written.
 */
test('an hour with something on it carries a mark and no colour of any kind', () => {
  render(<TimeColumns value="" onPick={() => {}} taken={[{ start: 540, end: 570, color: 'var(--cat-core)' }]} />)
  const nine = hours().getByRole('option', { name: /^09,/ })
  expect(nine.className).toContain('is-taken')
  expect(nine.getAttribute('style')).toBeNull()
  // And a free hour carries neither.
  expect(hours().getByRole('option', { name: '11' }).className).not.toContain('is-taken')
})

/**
 * The mark says an hour is not empty; how much of it is gone, and to what, is
 * the timeline's answer. The words keep the amount because they can say it
 * exactly - taking it away would leave somebody who is not looking at the
 * screen with less than the screen holds, which is the wrong direction to
 * even it up in.
 */
test('the words under a partly taken hour say how much, without rounding it to the hour', () => {
  render(<TimeColumns value="" onPick={() => {}} taken={[{ start: 545, end: 605, label: 'Deep work' }]} />)
  expect(hours().getByRole('option', { name: '09, 55 min taken by Deep work' })).toBeInTheDocument()
  expect(hours().getByRole('option', { name: '10, 5 min taken by Deep work' })).toBeInTheDocument()
})

/**
 * The whole point of showing what is taken is that it is shown *before* the
 * choice, not enforced after it. Overlapping is allowed and always was - a
 * commute running into the start of a shift is a real Tuesday - so nothing
 * here refuses, warns, or greys out.
 */
test('a taken hour is still an hour you can pick, and nothing about it is disabled', async () => {
  const user = userEvent.setup()
  const onPick = vi.fn()
  render(<TimeColumns value="" onPick={onPick} taken={NINE_TO_TEN} />)

  for (const option of hours().getAllByRole('option')) {
    expect(option).toBeEnabled()
    expect(option).not.toHaveAttribute('aria-disabled')
  }

  await user.click(hours().getByRole('option', { name: '09, taken by Deep work' }))
  expect(onPick).toHaveBeenCalledWith('09:00')
})

test('a field with no day behind it gets the plain columns it always had', () => {
  render(<TimeColumns value="" onPick={() => {}} />)
  expect(hours().getByRole('option', { name: '09' })).toBeInTheDocument()
  expect(hours().getAllByRole('option')).toHaveLength(24)
  expect(within(screen.getByRole('listbox', { name: 'Minute' })).getAllByRole('option')).toHaveLength(12)
})

// The two columns keep their roles and their names whatever is drawn on them:
// picking is still an hour and then a five, in either order, and typing into
// the field beside them is untouched.
test('picking is still an hour and then a five', async () => {
  const user = userEvent.setup()
  const onPick = vi.fn()
  render(<TimeColumns value="14:00" onPick={onPick} taken={NINE_TO_TEN} />)

  await user.click(within(screen.getByRole('listbox', { name: 'Minute' })).getByRole('option', { name: '30' }))
  expect(onPick).toHaveBeenCalledWith('14:30')
})
