import { expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarterOffers } from './StarterOffers'
import { STARTER_TEMPLATES } from '../../lib/starterTemplates'

test('renders one card per starter, each naming itself, its blocks, and its description', () => {
  render(<StarterOffers onUse={() => {}} />)
  for (const starter of STARTER_TEMPLATES) {
    const card = screen.getByText(starter.name, { selector: 'strong' }).closest('li')!
    const scoped = within(card)
    expect(scoped.getByText(starter.description)).toBeInTheDocument()
    for (const block of starter.blocks) {
      expect(scoped.getByText(block.title, { selector: '.starter-block-title' })).toBeInTheDocument()
    }
  }
})

test('a timed block shows its time; an untimed block shows none', () => {
  render(<StarterOffers onUse={() => {}} />)
  const restCard = screen.getByText('Rest day', { selector: 'strong' }).closest('li')!
  const scoped = within(restCard)
  expect(scoped.getByText('09:30')).toBeInTheDocument()
  expect(scoped.getByText('Sleep in, no alarm')).toBeInTheDocument()
})

test('tapping a card calls onUse with exactly that starter, and no other', async () => {
  const user = userEvent.setup()
  const onUse = vi.fn()
  render(<StarterOffers onUse={onUse} />)
  await user.click(screen.getByRole('button', { name: /use the rest day template/i }))
  expect(onUse).toHaveBeenCalledTimes(1)
  expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'rest-day' }))
})

test('every card exposes an accessible name naming its own template, not a repeated bare label', () => {
  render(<StarterOffers onUse={() => {}} />)
  for (const starter of STARTER_TEMPLATES) {
    expect(screen.getByRole('button', { name: new RegExp(`use the ${starter.name} template`, 'i') })).toBeInTheDocument()
  }
})
