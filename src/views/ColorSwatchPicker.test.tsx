import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { PALETTE_COLORS, paletteColorName } from '../lib/colors'

const COLORS = PALETTE_COLORS.map(c => c.value)

function setup(value = COLORS[0]) {
  const onChange = vi.fn()
  const view = render(
    <ColorSwatchPicker
      colors={COLORS}
      value={value}
      onChange={onChange}
      label="Template colour"
      nameOf={paletteColorName}
    />,
  )
  return { ...view, onChange }
}

/**
 * Eight swatches used to open the template editor: the largest and most
 * saturated thing on a form about a day's worth of blocks, seven of them
 * answers nobody had chosen. This is the same eight, behind the one that was.
 */

test('it shows the chosen colour and names it, with the other seven put away', () => {
  const { container } = setup(COLORS[1])
  expect(screen.getByRole('button', { name: 'Template colour: Coral. Change it.' })).toBeInTheDocument()
  expect(container.querySelectorAll('.swatch')).toHaveLength(1)
})

test('one press opens the eight, and picking one closes them again', async () => {
  const user = userEvent.setup()
  const { onChange, container } = setup()

  await user.click(screen.getByRole('button', { name: /Template colour/ }))
  expect(container.querySelectorAll('.swatch-picker-panel .swatch')).toHaveLength(COLORS.length)

  await user.click(screen.getByRole('button', { name: 'Green' }))
  expect(onChange).toHaveBeenCalledWith('#a7e3bd')
  expect(container.querySelector('.swatch-picker-panel')).toBeNull()
})

// A colour is decoration on top of a name that already carries the meaning,
// so the name is what a screen reader gets - the hex is the fallback for a
// value from a palette this build no longer offers.
test('every swatch is named, not numbered', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: /Template colour/ }))
  for (const c of PALETTE_COLORS) {
    expect(screen.getByRole('button', { name: c.name })).toBeInTheDocument()
  }
})

test('a press outside puts it away without changing anything', async () => {
  const user = userEvent.setup()
  const { onChange, container } = setup()

  await user.click(screen.getByRole('button', { name: /Template colour/ }))
  await user.click(document.body)
  expect(container.querySelector('.swatch-picker-panel')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})
