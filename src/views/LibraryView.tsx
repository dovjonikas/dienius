import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { addDays, todayKey } from '../lib/dates'
import {
  STARTER_LISTS,
  isItemFinished,
  itemProgress,
  progressLabel,
  progressPercent,
  unitPlural,
} from '../lib/library'
import type { LibraryItem, LibraryList } from '../lib/types'

/**
 * The Library: lists of things worked through a unit at a time.
 *
 * It exists because a day planner that can only hold today keeps losing the
 * things that take a month. A book is not a task - it is forty tasks nobody
 * wants to type - and the honest shape for it is a list with a place in it,
 * plus a way to spend one evening on it without re-deciding what "it" is.
 *
 * Three rules the whole screen follows:
 *
 * - The unit is the list's, not the app's. Every count on this page is
 *   spoken in the word its owner chose - chapters, episodes, lessons.
 * - Finished work collapses. A list you have read forty books from should
 *   open on the four you have not.
 * - Nothing is created until somebody asks. An empty Library offers two
 *   starters the way Templates offers three, and makes neither on its own.
 */
export function LibraryView({ onOpenDay }: { onOpenDay?: (date: string) => void }) {
  const data = useAppData()
  const [openListId, setOpenListId] = useState<string | null>(null)
  const [newListOpen, setNewListOpen] = useState(false)

  const lists = data.library

  if (lists.length === 0) {
    return (
      <section className="library">
        <div className="library-header">
          <h2>Library</h2>
        </div>
        {newListOpen ? (
          <NewListForm onDone={() => setNewListOpen(false)} />
        ) : (
          <div className="library-empty">
            <p className="muted">
              Things you work through a bit at a time - books, series, courses. Each list counts in its own
              word, and a session on one can go straight onto a day.
            </p>
            <div className="library-starters">
              {STARTER_LISTS.map(starter => (
                <button
                  key={starter.name}
                  type="button"
                  className="btn-secondary"
                  onClick={() => actions.addLibraryList(starter)}
                >
                  Start a {starter.name} list
                </button>
              ))}
              <button type="button" className="btn-secondary" onClick={() => setNewListOpen(true)}>
                Something else
              </button>
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="library">
      <div className="library-header">
        <h2>Library</h2>
        {!newListOpen && (
          <button type="button" className="btn-primary" onClick={() => setNewListOpen(true)}>
            New list
          </button>
        )}
      </div>
      {newListOpen && <NewListForm onDone={() => setNewListOpen(false)} />}
      <div className="library-lists">
        {lists.map(list => (
          <ListCard
            key={list.id}
            list={list}
            editing={openListId === list.id}
            onToggleEdit={() => setOpenListId(id => (id === list.id ? null : list.id))}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </section>
  )
}

function NewListForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [short, setShort] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function save() {
    if (!name.trim() || !unit.trim()) return
    actions.addLibraryList({ name, unit, unitShort: short })
    onDone()
  }

  return (
    <div className="library-new">
      <div className="library-new-fields">
        <label className="field">
          <span className="field-label">List name</span>
          <input ref={nameRef} value={name} onChange={e => setName(e.target.value)} placeholder="Courses" />
        </label>
        {/* Singular, because that is the form somebody thinks in when naming
            it, and the plural is derivable from it far more often than the
            other way round. */}
        <label className="field">
          <span className="field-label">One of them is a</span>
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="lesson" />
        </label>
        <label className="field">
          <span className="field-label">Short form</span>
          <input value={short} onChange={e => setShort(e.target.value)} placeholder="ls" maxLength={4} />
        </label>
      </div>
      <div className="library-new-actions">
        <button type="button" className="btn-primary" disabled={!name.trim() || !unit.trim()} onClick={save}>
          Create list
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  )
}

interface ListCardProps {
  list: LibraryList
  editing: boolean
  onToggleEdit: () => void
  onOpenDay?: (date: string) => void
}

function ListCard({ list, editing, onToggleEdit, onOpenDay }: ListCardProps) {
  const [draft, setDraft] = useState('')
  const [showFinished, setShowFinished] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const going = list.items.filter(i => !isItemFinished(i))
  const finished = list.items.filter(isItemFinished)

  function add() {
    if (!draft.trim()) return
    actions.addLibraryItem(list.id, draft)
    setDraft('')
  }

  return (
    <div className="library-list">
      <div className="library-list-head">
        <h3>{list.name}</h3>
        <span className="library-list-unit">
          {going.length} going, counted in {unitPlural(list)}
        </span>
        <button
          type="button"
          className="library-list-edit"
          aria-expanded={editing}
          aria-label={`Settings for ${list.name}`}
          onClick={onToggleEdit}
        >
          Edit
        </button>
      </div>

      {editing && (
        <div className="library-list-settings">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={list.name} onChange={e => actions.updateLibraryList(list.id, { name: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Unit</span>
            <input value={list.unit} onChange={e => actions.updateLibraryList(list.id, { unit: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Short</span>
            <input
              value={list.unitShort ?? ''}
              maxLength={4}
              onChange={e => actions.updateLibraryList(list.id, { unitShort: e.target.value })}
            />
          </label>
          <button
            type="button"
            className={confirmDelete ? 'btn-danger armed' : 'btn-danger'}
            onClick={() => (confirmDelete ? actions.deleteLibraryList(list.id) : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Delete, really' : 'Delete list'}
          </button>
        </div>
      )}

      {/* One field, one line, one Enter. The count is optional and comes from
          the same line - "Daring Greatly, 12 chapters" - so adding a thing
          with a known length costs no more taps than adding one without. */}
      <div className="library-add">
        <input
          value={draft}
          placeholder={`Add - try "Something good, 12 ${unitPlural(list)}"`}
          aria-label={`Add to ${list.name}`}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn-secondary" disabled={!draft.trim()} onClick={add}>
          Add
        </button>
      </div>

      {going.length === 0 && finished.length === 0 && (
        <p className="muted library-list-empty">Nothing on this list yet.</p>
      )}

      <ul className="library-items">
        {going.map((item, index) => (
          <ItemRow
            key={item.id}
            list={list}
            item={item}
            index={index}
            dragging={dragId === item.id}
            onDragStart={() => setDragId(item.id)}
            onDragEnd={() => setDragId(null)}
            onDropAt={to => actions.moveLibraryItem(list.id, dragId ?? item.id, to)}
            onOpenDay={onOpenDay}
          />
        ))}
      </ul>

      {finished.length > 0 && (
        <div className="library-finished">
          <button
            type="button"
            className="library-finished-toggle"
            aria-expanded={showFinished}
            onClick={() => setShowFinished(open => !open)}
          >
            Finished ({finished.length})
          </button>
          {showFinished && (
            <ul className="library-items is-finished">
              {finished.map(item => (
                <li key={item.id} className="library-item done">
                  <span className="library-item-title">{item.title}</span>
                  <span className="library-item-count">{progressLabel(list, item)}</span>
                  <button
                    type="button"
                    className="library-item-reopen"
                    onClick={() => actions.toggleLibraryItemFinished(list.id, item.id, todayKey())}
                  >
                    Reopen
                  </button>
                  <button
                    type="button"
                    className="library-item-remove"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => actions.deleteLibraryItem(list.id, item.id)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

interface ItemRowProps {
  list: LibraryList
  item: LibraryItem
  index: number
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDropAt: (index: number) => void
  onOpenDay?: (date: string) => void
}

function ItemRow({ list, item, index, dragging, onDragStart, onDragEnd, onDropAt, onOpenDay }: ItemRowProps) {
  const [scheduling, setScheduling] = useState(false)
  const [already, setAlready] = useState<string | null>(null)
  const percent = progressPercent(item)

  // A refused schedule says so and stays put rather than silently doing
  // nothing or quietly adding a second identical card - see
  // actions.scheduleLibraryItem. Not a toast: the answer belongs on the row
  // that was tapped, where the eye already is.
  function schedule(date: string, label: string) {
    if (!actions.scheduleLibraryItem(date, list.id, item.id)) {
      setAlready(label)
      return
    }
    setAlready(null)
    setScheduling(false)
    onOpenDay?.(date)
  }

  return (
    <li
      className={dragging ? 'library-item is-dragging' : 'library-item'}
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        onDropAt(index)
        onDragEnd()
      }}
      onDragEnd={onDragEnd}
    >
      <span className="library-item-grip" aria-hidden="true" />
      <div className="library-item-main">
        <span className="library-item-title">{item.title}</span>
        {percent !== undefined && (
          <span className="library-item-bar" aria-hidden="true">
            <span className="library-item-bar-fill" style={{ width: `${percent}%` }} />
          </span>
        )}
      </div>

      {/* The count, and the two buttons that correct it by hand. Progress
          normally moves by ticking a task off; this is for the evening you
          read three chapters and only planned one. */}
      <div className="library-item-progress">
        <button
          type="button"
          className="library-step"
          aria-label={`One fewer ${list.unit} of ${item.title}`}
          disabled={itemProgress(item) === 0}
          onClick={() => actions.stepLibraryItem(list.id, item.id, -1, todayKey())}
        >
          &minus;
        </button>
        <span className="library-item-count">{progressLabel(list, item)}</span>
        <button
          type="button"
          className="library-step"
          aria-label={`One more ${list.unit} of ${item.title}`}
          onClick={() => actions.stepLibraryItem(list.id, item.id, 1, todayKey())}
        >
          +
        </button>
      </div>

      <div className="library-item-actions">
        {scheduling ? (
          <div className="library-schedule" role="group" aria-label={`Schedule ${item.title}`}>
            {already ? (
              <span className="library-schedule-note" role="status">
                Already on {already}
              </span>
            ) : (
              <>
                <button type="button" onClick={() => schedule(todayKey(), 'today')}>
                  Today
                </button>
                <button type="button" onClick={() => schedule(addDays(todayKey(), 1), 'tomorrow')}>
                  Tomorrow
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setScheduling(false)
                setAlready(null)
              }}
              aria-label="Cancel scheduling"
            >
              &times;
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="library-item-schedule"
            aria-label={`Schedule ${item.title}`}
            onClick={() => setScheduling(true)}
          >
            Schedule
          </button>
        )}
        <button
          type="button"
          className="library-item-remove"
          aria-label={`Remove ${item.title}`}
          onClick={() => actions.deleteLibraryItem(list.id, item.id)}
        >
          &times;
        </button>
      </div>
    </li>
  )
}
