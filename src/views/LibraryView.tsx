import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { addDays, todayKey } from '../lib/dates'
import {
  LIST_PRESETS,
  STARTER_LISTS,
  hasAnotherSeason,
  isItemFinished,
  itemProgress,
  progressLabel,
  progressPercent,
  stepsOneAtATime,
  unitPlural,
} from '../lib/library'
import { isListOpen, rememberListOpen } from '../lib/libraryPrefs'
import { CATEGORIES } from '../lib/categories'
import type { LibraryItem, LibraryList, LibraryTrack, Template } from '../lib/types'
import { useListReorder } from './useListReorder'
import { offerUndo } from '../lib/undo'

/**
 * The Library: lists of things worked through a unit at a time.
 *
 * It exists because a day planner that can only hold today keeps losing the
 * things that take a month. A book is not a task - it is forty tasks nobody
 * wants to type - and the honest shape for it is a list with a place in it,
 * plus a way to spend one evening on it without re-deciding what "it" is.
 *
 * Four rules the whole screen follows. The first three are older than this
 * version; the fourth is what this version is:
 *
 * - The unit is the list's, not the app's. Every count on this page is spoken
 *   in the word its owner chose - chapters, episodes, lessons - except where
 *   the item itself asks for something else, which is what `LibraryTrack` is.
 * - Finished work collapses. A list you have read forty books from should
 *   open on the four you have not.
 * - Nothing is created until somebody asks.
 * - **One thing on this page is loud, and it is what you are actually on.**
 *   The first unfinished item in each list gets a real card with its progress
 *   and its pace note; everything behind it is one quiet line. That is the
 *   only hierarchy here, and it is the fix for the version before this one,
 *   where thirteen books and five things to watch were thirteen and five
 *   identical rows with four buttons each, and finding anything meant reading
 *   all of them.
 */
export function LibraryView({ onOpenDay }: { onOpenDay?: (date: string) => void }) {
  const data = useAppData()
  const [newListOpen, setNewListOpen] = useState(false)
  // Which lists are open, held here rather than in each section so the chip
  // row above can open one. Seeded from what this device last did - see
  // lib/libraryPrefs.ts - and written back on every change, so the fold
  // survives a reload without ever travelling to another device.
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.library.map(list => [list.id, isListOpen(list.id)])),
  )
  const lists = data.library

  function setOpen(listId: string, open: boolean) {
    rememberListOpen(listId, open)
    setOpenIds(current => ({ ...current, [listId]: open }))
  }

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
                  data-tour="library-starter"
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
          <button
            type="button"
            className="btn-primary"
            /* The tour's fallback target: the starter offers only exist while
               the library is empty, and somebody with one list already has
               none to point at. See lib/tour.ts. */
            data-tour="library-new"
            onClick={() => setNewListOpen(true)}
          >
            New list
          </button>
        )}
      </div>
      {newListOpen && <NewListForm onDone={() => setNewListOpen(false)} />}

      {/* Every list in one line, with what is going in each. It is here
          because the page is long and the question at the top of it is
          usually "where is Watching" rather than "what is in Books" - and a
          chip that answers by scrolling to the list beats a chip that opens a
          different screen. One list on its own does not need it. */}
      {lists.length > 1 && (
        <nav className="library-chips" aria-label="Jump to a list">
          {lists.map(list => {
            const going = list.items.filter(i => !isItemFinished(i)).length
            return (
              <button
                key={list.id}
                type="button"
                className="library-chip"
                style={list.color ? ({ ['--dot' as string]: list.color } as React.CSSProperties) : undefined}
                onClick={() => {
                  setOpen(list.id, true)
                  document.getElementById(sectionId(list.id))?.scrollIntoView({ block: 'start' })
                }}
              >
                {list.color && <span className="library-chip-dot" aria-hidden="true" />}
                {list.name}
                <span className="library-chip-count">{going} going</span>
              </button>
            )
          })}
        </nav>
      )}

      <div className="library-lists">
        {lists.map(list => (
          <ListSection
            key={list.id}
            list={list}
            open={openIds[list.id] ?? isListOpen(list.id)}
            onToggleOpen={() => setOpen(list.id, !(openIds[list.id] ?? isListOpen(list.id)))}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </section>
  )
}

function sectionId(listId: string): string {
  return `library-list-${listId}`
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
      {/* The three that kept being typed by hand, beside the form rather than
          instead of it. The form was never hard; it was three decisions in a
          row at the moment somebody had one idea. */}
      <div className="library-presets">
        <span className="muted">Quick start:</span>
        {LIST_PRESETS.map(preset => (
          <button
            key={preset.name}
            type="button"
            className="library-preset"
            onClick={() => {
              actions.addLibraryList(preset)
              onDone()
            }}
          >
            {preset.name}
            <span className="library-preset-unit">{unitPlural(preset)}</span>
          </button>
        ))}
      </div>
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

interface ListSectionProps {
  list: LibraryList
  open: boolean
  onToggleOpen: () => void
  onOpenDay?: (date: string) => void
}

function ListSection({ list, open, onToggleOpen, onOpenDay }: ListSectionProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [showFinished, setShowFinished] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const itemsRef = useRef<HTMLUListElement>(null)
  const reorder = useListReorder(itemsRef, (id, to) => actions.moveLibraryItem(list.id, id, to))

  const going = list.items.filter(i => !isItemFinished(i))
  const finished = list.items.filter(isItemFinished)
  // The one thing that is loud. First rather than "most recently touched",
  // for the same reason `currentItem` is: the list is hand-ordered, the owner
  // has already said which is next by putting it there, and second-guessing
  // that with a timestamp would make the order they arranged mean nothing.
  const [active, ...rest] = going

  function add() {
    if (!draft.trim()) return
    actions.addLibraryItem(list.id, draft)
    setDraft('')
  }

  /** Removing an item, with the whole list kept for five seconds. */
  function removeItem(itemId: string, title: string) {
    const before = list
    actions.deleteLibraryItem(list.id, itemId)
    offerUndo(`${title} removed from ${list.name}`, () => actions.replaceLibraryList(before))
  }

  const rowProps = (item: LibraryItem, index: number) => ({
    list,
    item,
    index,
    dragging: reorder.draggingId === item.id,
    over: reorder.overIndex === index && reorder.draggingId !== null && reorder.draggingId !== item.id,
    detailOpen: detailId === item.id,
    onToggleDetail: () => setDetailId(id => (id === item.id ? null : item.id)),
    onGripPointerDown: (e: React.PointerEvent) => reorder.start(item.id, index, e),
    onNudge: (by: number) =>
      actions.moveLibraryItem(list.id, item.id, Math.max(0, Math.min(list.items.length - 1, index + by))),
    onRemove: () => removeItem(item.id, item.title),
    onOpenDay,
  })

  return (
    <div className={open ? 'library-list is-open' : 'library-list'} id={sectionId(list.id)}>
      <div className="library-list-head">
        <button type="button" className="library-list-fold" aria-expanded={open} onClick={onToggleOpen}>
          <span className="done-caret" aria-hidden="true" />
          {list.color && (
            <span
              className="library-chip-dot"
              style={{ ['--dot' as string]: list.color } as React.CSSProperties}
              aria-hidden="true"
            />
          )}
          <h3>{list.name}</h3>
          <span className="library-list-unit">
            {going.length} going, counted in {unitPlural(list)}
          </span>
        </button>
        <button
          type="button"
          className="library-list-edit"
          aria-expanded={settingsOpen}
          aria-label={`Settings for ${list.name}`}
          onClick={() => setSettingsOpen(o => !o)}
        >
          Edit
        </button>
      </div>

      {settingsOpen && (
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
          {/* Six hues and off, from the same palette the categories use, so a
              chip row can be read at a glance. Nothing sorts or filters by
              it; it is a dot. */}
          <div className="field">
            <span className="field-label">Dot</span>
            <div className="library-colors" role="group" aria-label={`Colour for ${list.name}`}>
              <button
                type="button"
                className={list.color ? 'library-color' : 'library-color is-on'}
                aria-pressed={!list.color}
                aria-label="No colour"
                onClick={() => actions.updateLibraryList(list.id, { color: undefined })}
              />
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={list.color === c.color ? 'library-color is-on' : 'library-color'}
                  style={{ ['--dot' as string]: c.color } as React.CSSProperties}
                  aria-pressed={list.color === c.color}
                  aria-label={c.label}
                  onClick={() => actions.updateLibraryList(list.id, { color: c.color })}
                />
              ))}
            </div>
          </div>
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

      {open && (
        <>
          {going.length === 0 && finished.length === 0 && (
            <p className="muted library-list-empty">Nothing on this list yet.</p>
          )}

          {active && (
            <ul className="library-items is-active">
              <ItemRow {...rowProps(active, 0)} active />
            </ul>
          )}

          {rest.length > 0 && (
            <ul className="library-items" ref={itemsRef}>
              {rest.map((item, index) => (
                <ItemRow key={item.id} {...rowProps(item, index + 1)} />
              ))}
            </ul>
          )}

          {/* One field, one line, one Enter. The count is optional and comes
              from the same line - "Daring Greatly, 12 chapters" - and so is
              the shape: "139 pages", "3 seasons", "movie". */}
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

          {finished.length > 0 && (
            <div className="library-finished">
              <button
                type="button"
                className="library-finished-toggle"
                aria-expanded={showFinished}
                onClick={() => setShowFinished(o => !o)}
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
                        onClick={() => removeItem(item.id, item.title)}
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface ItemRowProps {
  list: LibraryList
  item: LibraryItem
  index: number
  active?: boolean
  dragging: boolean
  /** True when a drop right now would land on this row. */
  over: boolean
  detailOpen: boolean
  onToggleDetail: () => void
  onGripPointerDown: (e: React.PointerEvent) => void
  onNudge: (by: number) => void
  onRemove: () => void
  onOpenDay?: (date: string) => void
}

/**
 * One item, in one of two sizes.
 *
 * The active card carries its progress bar and its pace note; every other row
 * is a title and a count. That split is the whole navigation model of this
 * screen - and the reason there are no longer four buttons on every line.
 * Everything a row can do is behind tapping it, which opens the panel below
 * it. On a pointer the row also reveals its two commonest actions on hover,
 * because a mouse can afford them and a thumb cannot.
 */
function ItemRow({
  list,
  item,
  index,
  active = false,
  dragging,
  over,
  detailOpen,
  onToggleDetail,
  onGripPointerDown,
  onNudge,
  onRemove,
  onOpenDay,
}: ItemRowProps) {
  const percent = progressPercent(item)

  return (
    <li
      className={[
        'library-item',
        active ? 'is-active' : '',
        dragging ? 'is-dragging' : '',
        over ? 'is-over' : '',
        detailOpen ? 'is-detailed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-reorder-index={index}
    >
      {/* A real button, not a decorative handle: it is dragged with a pointer
          or a finger, and moved a place at a time with the arrow keys, so the
          order is reachable by every input this app supports. */}
      <button
        type="button"
        className="library-item-grip"
        aria-label={`Reorder ${item.title}, position ${index + 1}`}
        onPointerDown={onGripPointerDown}
        onKeyDown={e => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          onNudge(e.key === 'ArrowUp' ? -1 : 1)
        }}
      >
        <span className="library-item-grip-dots" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="library-item-open"
        aria-expanded={detailOpen}
        aria-label={`${item.title}, ${progressLabel(list, item)}`}
        onClick={onToggleDetail}
      >
        <span className="library-item-main">
          <span className="library-item-title">{item.title}</span>
          {active && percent !== undefined && (
            <span className="library-item-bar" aria-hidden="true">
              <span className="library-item-bar-fill" style={{ width: `${percent}%` }} />
            </span>
          )}
          {/* Only on the card that is loud. On a quiet row it would be a
              second line of prose on every line of a list of thirteen. */}
          {active && item.pace && <span className="library-item-pace">{item.pace}</span>}
        </span>
        <span className="library-item-count">{progressLabel(list, item)}</span>
      </button>

      {/* The two commonest things, revealed by a pointer. A finger opens the
          panel instead, which has these and everything else - see the CSS.
          Gone while the panel is open, because the panel has them: two
          buttons with the same name doing the same thing is a row a screen
          reader announces twice. */}
      {!detailOpen && (
      <div className="library-item-hover">
        {stepsOneAtATime(item) && (
          <button
            type="button"
            className="library-step"
            aria-label={`One more ${list.unit} of ${item.title}`}
            onClick={() => actions.stepLibraryItem(list.id, item.id, 1, todayKey())}
          >
            +
          </button>
        )}
        <button
          type="button"
          className="library-item-remove"
          aria-label={`Remove ${item.title}`}
          onClick={onRemove}
        >
          &times;
        </button>
      </div>
      )}

      {detailOpen && <ItemDetail list={list} item={item} onOpenDay={onOpenDay} onRemove={onRemove} />}
    </li>
  )
}

interface ItemDetailProps {
  list: LibraryList
  item: LibraryItem
  onOpenDay?: (date: string) => void
  onRemove: () => void
}

/**
 * Everything one item can do, in one place, opened by tapping the row.
 *
 * Inline under the row rather than floating beside it, and that is a
 * deliberate choice against the obvious one. A popover has to be positioned,
 * and this app has already shipped two bugs where one measured itself against
 * the wrong ancestor and one hung off the bottom of a phone. A panel that
 * pushes the list down cannot do either, works identically on both platforms,
 * and needs no code to decide which side it opens on.
 */
function ItemDetail({ list, item, onOpenDay, onRemove }: ItemDetailProps) {
  const [pace, setPace] = useState(item.pace ?? '')
  const [page, setPage] = useState(String(itemProgress(item)))
  const [scheduled, setScheduled] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)

  const track: LibraryTrack | 'units' = item.track ?? 'units'

  function schedule(date: string, label: string) {
    if (!actions.scheduleLibraryItem(date, list.id, item.id)) {
      setScheduled(`Already on ${label}`)
      return
    }
    setScheduled(null)
    onOpenDay?.(date)
  }

  return (
    <div className="library-detail">
      <div className="library-detail-row">
        <span className="field-label">Counted in</span>
        <div className="segmented" role="group" aria-label={`How ${item.title} is counted`}>
          {(['units', 'pages', 'series', 'movie'] as const).map(option => (
            <button
              key={option}
              type="button"
              className={track === option ? 'active' : ''}
              aria-pressed={track === option}
              onClick={() =>
                actions.updateLibraryItem(list.id, item.id, { track: option === 'units' ? null : option })
              }
            >
              {option === 'units' ? unitPlural(list) : option === 'movie' ? 'one sitting' : option}
            </button>
          ))}
        </div>
      </div>

      {track === 'movie' ? (
        <div className="library-detail-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => actions.toggleLibraryItemFinished(list.id, item.id, todayKey())}
          >
            {isItemFinished(item) ? 'Not watched after all' : 'Watched it'}
          </button>
        </div>
      ) : (
        <div className="library-detail-row">
          <span className="field-label">{track === 'pages' ? 'On page' : 'Done'}</span>
          {/* Typed, not stepped, for pages: nobody presses + fifty-four
              times, and a control that expects them to is a control that
              quietly stops being used. */}
          {track === 'pages' ? (
            <>
              <input
                className="library-page-input"
                inputMode="numeric"
                aria-label={`Page you are on in ${item.title}`}
                value={page}
                onChange={e => setPage(e.target.value)}
                onBlur={() => {
                  const next = Number(page.trim())
                  if (Number.isInteger(next) && next >= 0) actions.setLibraryItemProgress(list.id, item.id, next, todayKey())
                  else setPage(String(itemProgress(item)))
                }}
              />
              <span className="muted">of {item.total ?? '?'}</span>
            </>
          ) : (
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
          )}
        </div>
      )}

      {track === 'series' && (
        <div className="library-detail-row">
          <span className="field-label">Season</span>
          <input
            className="library-page-input"
            inputMode="numeric"
            aria-label={`Season of ${item.title}`}
            value={item.season ?? ''}
            placeholder="-"
            onChange={e => {
              const next = Number(e.target.value.trim())
              actions.updateLibraryItem(list.id, item.id, {
                season: e.target.value.trim() === '' ? null : Number.isInteger(next) ? next : undefined,
              })
            }}
          />
          <span className="muted">of {item.seasons ?? '?'}</span>
          {hasAnotherSeason(item) && itemProgress(item) > 0 && item.total !== undefined && itemProgress(item) >= item.total && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => actions.advanceLibrarySeason(list.id, item.id)}
            >
              Start season {(item.season ?? 1) + 1}
            </button>
          )}
        </div>
      )}

      <label className="field library-detail-pace">
        <span className="field-label">Pace or note</span>
        {/* One field, not two. "One chapter a day" is both the pace and the
            note anybody would write, and a second free-text box with nothing
            reading it is exactly the kind of structure CONVENTIONS section 11
            says to add a way out for rather than a field to hold. */}
        <input
          value={pace}
          maxLength={80}
          placeholder="one chapter a day"
          onChange={e => setPace(e.target.value)}
          onBlur={() => actions.updateLibraryItem(list.id, item.id, { pace: pace.trim() === '' ? null : pace })}
        />
      </label>

      <div className="library-detail-actions">
        <button type="button" className="btn-secondary" onClick={() => schedule(todayKey(), 'today')}>
          Onto today
        </button>
        <button type="button" className="btn-secondary" onClick={() => schedule(addDays(todayKey(), 1), 'tomorrow')}>
          Onto tomorrow
        </button>
        <button type="button" className="btn-secondary" onClick={() => setTemplateOpen(o => !o)}>
          Add to template
        </button>
        <button type="button" className="library-item-remove" aria-label={`Remove ${item.title}`} onClick={onRemove}>
          Remove
        </button>
      </div>
      {scheduled && (
        <p className="library-schedule-note" role="status">
          {scheduled}
        </p>
      )}
      {templateOpen && <AddToTemplate list={list} onDone={() => setTemplateOpen(false)} />}
    </div>
  )
}

/**
 * Putting a recurring session for this list onto a template, in one flow.
 *
 * It used to be two screens and a piece of knowledge nobody has: go to
 * Templates, build a block, find the binding control on it. Here it is a
 * template, a time and a length.
 *
 * **It binds to the list, not to the item it was opened from**, which is the
 * whole point of the binding as it already existed: the block says "a reading
 * session", the list says which book, and finishing a book moves the block on
 * to the next one instead of leaving a dead block behind.
 */
function AddToTemplate({ list, onDone }: { list: LibraryList; onDone: () => void }) {
  const data = useAppData()
  const [templateId, setTemplateId] = useState(data.templates[0]?.id ?? '')
  const [time, setTime] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [clash, setClash] = useState<Template | null>(null)

  if (data.templates.length === 0) {
    return <p className="muted library-detail-note">No templates yet - build one first, in the Templates tab.</p>
  }

  const block = {
    title: `${list.name} session`,
    time: time.trim() || undefined,
    minutes: Number(minutes) > 0 ? Number(minutes) : undefined,
  }

  return (
    <div className="library-template-form">
      <label className="field">
        <span className="field-label">Template</span>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
          {data.templates.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">At</span>
        <input value={time} placeholder="21:00" onChange={e => setTime(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">For</span>
        <input value={minutes} inputMode="numeric" onChange={e => setMinutes(e.target.value)} />
      </label>
      {clash ? (
        // Offered, never done twice: two reading blocks on one template both
        // pointing at the same list is not something anybody meant.
        <div className="library-template-clash" role="status">
          <span>{clash.name} already has a {list.name} block.</span>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              actions.replaceLibraryBlockOnTemplate(clash.id, list.id, block)
              onDone()
            }}
          >
            Change that one
          </button>
          <button type="button" className="btn-secondary" onClick={() => setClash(null)}>
            Leave it
          </button>
        </div>
      ) : (
        <div className="library-new-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (actions.addLibraryBlockToTemplate(templateId, list.id, block)) onDone()
              else setClash(data.templates.find(t => t.id === templateId) ?? null)
            }}
          >
            Add block
          </button>
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
