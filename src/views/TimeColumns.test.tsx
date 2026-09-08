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
 * jsdom paints nothing, so the wash itself is a job for the browser walk. What
 * can be held here is the wiring underneath it: the category's own colour, and
 * the share of the hour that is gone, actually reach the option the stylesheet
 * reads them off.
 */
test('the option carries the category colour and how much of the hour it holds', () => {
  render(<TimeColumns value="" onPick={() => {}} taken={[{ start: 540, end: 570, color: 'var(--cat-core)' }]} />)
  const style = hours().getByRole('option', { name: /^09,/ }).getAttribute('style') ?? ''
  expect(style).toContain('--cat: var(--cat-core)')
  expect(style).toContain('--taken: 50%')
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
