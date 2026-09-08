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

/**
 * The shape the two header popovers have: the surface itself takes no focus,
 * a child of it does. React runs a child's effects before its parent's, so
 * capturing the opener in an effect captured the child - and the restore
 * then had nothing to give focus back to, because the child went with the
 * panel. Found in v2.10 by walking the app with nothing but a keyboard.
 */
function PanelWithFocusingChild({ onClose }: { onClose: () => void }) {
  useRestoreFocus()
  return (
    <div role="dialog" aria-label="Panel">
      <NoteField />
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

function NoteField() {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return <textarea ref={ref} aria-label="A quick note" />
}

test('a panel whose child takes focus still hands it back to the opener', async () => {
  const user = userEvent.setup()
  function Host() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        {open && <PanelWithFocusingChild onClose={() => setOpen(false)} />}
      </>
    )
  }
  render(<Host />)

  const opener = screen.getByRole('button', { name: 'Open' })
  await user.click(opener)
  // The child has focus, which is the whole point of the case.
  expect(screen.getByLabelText('A quick note')).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(opener).toHaveFocus()
})

/**
 * A sheet opened from inside another sheet, which is what pressing Details
 * on a task's actions menu does: the menu closes and the detail sheet opens
 * in the same commit, so the button the detail sheet captures leaves the
 * page with the menu it sat in. Escape then had nothing to restore to and
 * landed on the body. Found in v2.10, by walking the app on a keyboard.
 */
test('a sheet opened from inside another falls back to the button the chain started from', async () => {
  const user = userEvent.setup()
  function Chain() {
    const [menu, setMenu] = useState(false)
    const [sheet, setSheet] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setMenu(true)}>
          More actions
        </button>
        {menu && (
          <Surface label="Menu">
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                setSheet(true)
              }}
            >
              Details
            </button>
          </Surface>
        )}
        {sheet && (
          <Surface label="Details">
            <button type="button" onClick={() => setSheet(false)}>
              Close
            </button>
          </Surface>
        )}
      </>
    )
  }

  function Surface({ label, children }: { label: string; children: React.ReactNode }) {
    useRestoreFocus()
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      ref.current?.focus()
    }, [])
    return (
      <div ref={ref} tabIndex={-1} role="dialog" aria-label={label}>
        {children}
      </div>
    )
  }

  render(<Chain />)
  const opener = screen.getByRole('button', { name: 'More actions' })
  await user.click(opener)
  await user.click(screen.getByRole('button', { name: 'Details' }))
  expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  // Not the body: the button the whole chain started from, which is the only
  // one of the three still on the page.
  expect(opener).toHaveFocus()
})
