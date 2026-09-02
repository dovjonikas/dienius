import { useId, useState } from 'react'
import { actions, useAppData } from '../../lib/store'

export interface InboxProps {
  /** The day an item is scheduled onto when it is pulled out of the inbox. */
  date: string
}

/**
 * Everything caught and not yet decided about.
 *
 * Collapsed by default with a count on the fold, for the same reason the Done
 * section is: an inbox that is open all the time is a second task list
 * competing with the real one, which is exactly the thing it exists to keep
 * out of the way. The badge is what it needs to say most of the time - there
 * are four things in here - and the contents are one tap away when there is
 * room in the day to deal with them.
 *
 * Two ways out of it and no more: put it on this day, or delete it. Anything
 * else - which day, what time, how long - is a decision the inbox exists to
 * let somebody postpone, and asking it here would put the friction straight
 * back in. Once an item is a task on a day, every one of those questions has
 * a control on the card already.
 */
export function Inbox({ date }: InboxProps) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const listId = useId()
  const items = data.inbox

  if (items.length === 0) return null

  return (
    <div className={open ? 'inbox-section open' : 'inbox-section'}>
      <button
        type="button"
        className="done-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(o => !o)}
      >
        <span className="done-caret" aria-hidden="true" />
        Inbox
        <span className="inbox-badge">{items.length}</span>
      </button>
      <ul className="inbox-list" id={listId}>
        {items.map(item => (
          <li key={item.id} className="inbox-item">
            <span className="inbox-item-text">{item.text}</span>
            <div className="inbox-item-actions">
              <button
                type="button"
                className="inbox-item-plan"
                aria-label={`Add "${item.text}" to this day`}
                onClick={() => actions.scheduleInboxItem(item.id, date)}
              >
                Add to day
              </button>
              {/* The same confirming second tap deleting an if-then entry
                  already takes. An inbox item is one line somebody typed
                  quickly, and a stray tap on a small control should not be
                  able to lose it. */}
              <button
                type="button"
                className={confirmId === item.id ? 'inbox-item-delete danger' : 'inbox-item-delete'}
                aria-label={
                  confirmId === item.id ? `Confirm delete "${item.text}"` : `Delete "${item.text}"`
                }
                onBlur={() => setConfirmId(current => (current === item.id ? null : current))}
                onClick={() => {
                  if (confirmId === item.id) {
                    actions.deleteInboxItem(item.id)
                    setConfirmId(null)
                  } else {
                    setConfirmId(item.id)
                  }
                }}
              >
                {confirmId === item.id ? 'Sure?' : '×'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
