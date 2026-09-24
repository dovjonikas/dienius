import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DurationControl } from './DurationControl'

/**
 * A length's control says its length the way it shows it. Somebody who
 * drives the screen by voice says what they see - "45 min" - and the button
 * has to answer to it: its name holds its words (WCAG 2.5.3, the label in
 * the name). Lighthouse found the value button showing "45min" as one word
 * to everything but the eye, and named "45 min long", which does not hold
 * it. The gap stays drawn; the words carry a space of their own now.
 */

test("the value button's name holds the length as it is shown", () => {
  render(<DurationControl minutes={45} onChange={() => {}} />)
  const button = screen.getByRole('button', { name: '45 min long. Change how long.' })
  const shown = (button.textContent ?? '').replace(/\s+/g, ' ').trim()
  expect(shown).toBe('45 min')
  expect(button.getAttribute('aria-label')).toContain(shown)
})

test("a chip is named by its length, a number and a unit, and an hour keeps its own shape", async () => {
  const user = userEvent.setup()
  render(<DurationControl minutes={45} onChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: '45 min long. Change how long.' }))
  expect(screen.getByRole('button', { name: '15 min' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '1h' })).toBeInTheDocument()
})
