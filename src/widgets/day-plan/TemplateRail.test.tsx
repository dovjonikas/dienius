import { beforeEach, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateRail } from './TemplateRail'
import { actions, getData } from '../../lib/store'
import { defaultData } from '../../lib/storage'

const DATE = '2026-09-01'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

test('renders nothing when there are no templates yet', () => {
  const { container } = render(<TemplateRail date={DATE} />)
  expect(container).toBeEmptyDOMElement()
})

// The template's colour arrives as a custom property rather than as the
// chip's own background: it paints a dot now, not the whole pill. See the
// .template-chip block in styles.css for why.
test('renders one chip per template, coloured and named', () => {
  actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  render(<TemplateRail date={DATE} />)
  const work = screen.getByRole('button', { name: 'Work day' })
  const rest = screen.getByRole('button', { name: 'Rest day' })
  expect(work.style.getPropertyValue('--chip')).toBe('#8ab6f9')
  expect(rest.style.getPropertyValue('--chip')).toBe('#cde39e')
})

test('the currently-stamped template renders selected; the rest do not', () => {
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  expect(screen.getByRole('button', { name: 'Work day' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Rest day' })).toHaveAttribute('aria-pressed', 'false')
})

test('tapping a chip stamps that template onto the day currently open', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
})

test('tapping the already-stamped chip again re-applies it rather than clearing it - stamping stays additive-only here', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Work day' }))
  expect(getData().days[DATE]?.templateId).toBe(work.id)
})

test('tapping a different template restamps the day to that template', async () => {
  const user = userEvent.setup()
  const work = actions.addTemplate({ name: 'Work day', color: '#8ab6f9', blocks: [] })
  const rest = actions.addTemplate({ name: 'Rest day', color: '#cde39e', blocks: [] })
  actions.stamp({ [DATE]: work.id })
  render(<TemplateRail date={DATE} />)
  await user.click(screen.getByRole('button', { name: 'Rest day' }))
  expect(getData().days[DATE]?.templateId).toBe(rest.id)
})
