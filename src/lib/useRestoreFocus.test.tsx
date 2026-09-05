import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useRef, useState } from 'react'
import { useRestoreFocus } from './useRestoreFocus'

/** The shape every sheet in the app has: takes focus on mount, closes on a button. */
function Sheet({ onClose }: { onClose: () => void }) {
  useRestoreFocus()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label="Sheet">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

function Host({ openerStays = true }: { openerStays?: boolean }) {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  return (
    <>
      {(openerStays || !everOpened || open) && (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setEverOpened(true)
          }}
        >
          Open
        </button>
      )}
      {open && <Sheet onClose={() => setOpen(false)} />}
      <button type="button" onClick={() => setOpen(false)}>
        Elsewhere
      </button>
    </>
  )
}

/**
 * Closing a sheet must put focus back where it was. Until v2.1 it did not,
 * and a keyboard user closing the task menu found themselves at the top of
 * the document with the whole page to tab through again.
 */
test('closing a sheet hands focus back to the control that opened it', async () => {
  const user = userEvent.setup()
  render(<Host />)
  await user.click(screen.getByRole('button', { name: 'Open' }))
  expect(screen.getByRole('dialog', { name: 'Sheet' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
})

test('a sheet closed by a press somewhere else leaves focus where the press put it', async () => {
  const user = userEvent.setup()
  render(<Host />)
  await user.click(screen.getByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
})

test('an opener that has left the page is not chased', async () => {
  const user = userEvent.setup()
  render(<Host openerStays={false} />)
  await user.click(screen.getByRole('button', { name: 'Open' }))
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('button', { name: 'Open' })).toBeNull()
  expect(document.body).toHaveFocus()
})
