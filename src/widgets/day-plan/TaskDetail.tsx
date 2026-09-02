import { useEffect, useId, useRef, useState } from 'react'
import { actions } from '../../lib/store'
import { CATEGORIES, categoryColor } from '../../lib/categories'
import { progressLabel, progressPercent } from '../../lib/library'
import { MAX_HIGHLIGHTS, type LibraryList, type Repeat, type Task } from '../../lib/types'
import { TimePicker } from '../../views/TimePicker'
import { formatDuration, parseMinutesInput, stepTime } from './capacity'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const REPEATS: { value: Repeat | ''; label: string }[] = [
  { value: '', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Every week' },
]

export interface TaskDetailProps {
  task: Task
  /** Every task on the day, for the highlight count the header shows. */
  tasks: Task[]
  date: string
  library: LibraryList[]
  onClose: () => void
}

/**
 * Everything about one task, in one place.
 *
 * The row deliberately shows four things (see `TaskRow.tsx`). Everything a
 * task can also be - a note, three sub-steps, a repeat, an exact minute, a
 * book it belongs to - has to live somewhere that is one deliberate action
 * away and nowhere near the daily scan. This is that somewhere.
 *
 * One component for both shapes: a panel anchored to the middle on a wide
 * screen, the same panel pinned to the bottom edge on a phone, decided
 * entirely in CSS. Two components would drift, and there is no behavioural
 * difference between them - only where the rectangle sits.
 */
export function TaskDetail({ task, tasks, date, library, onClose }: TaskDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // How far the sheet has been pulled down, in pixels. Only ever non-zero
  // during a drag on the grab bar - see onGrabPointerDown.
  const [pullY, setPullY] = useState(0)
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note ?? '')
  const [size, setSize] = useState(task.minutes !== undefined ? String(task.minutes) : '')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  // Which of the two a change means, held while the sheet is open. Defaults
  // to the series, because that is what somebody who set up a repeat almost
  // always means - the exception is the exception.
  const [scope, setScope] = useState<'day' | 'series'>('series')
  const titleId = useId()

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const highlights = tasks.filter(t => t.highlight).length
  const highlightFull = !task.highlight && highlights >= MAX_HIGHLIGHTS
  const subtasks = task.subtasks ?? []
  const doneSubtasks = subtasks.filter(s => s.done).length
  // A source with a repeat, or an instance generated from one. A task that
  // repeats and has never generated anything yet is still a series - it is
  // about to be.
  const inSeries = !!task.repeat || !!task.repeatOf
  const boundList = task.libraryRef ? library.find(l => l.id === task.libraryRef!.listId) : undefined
  const boundItem = boundList?.items.find(i => i.id === task.libraryRef!.itemId)

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Committed on blur rather than on every keystroke: a title being retyped
  // passes through a dozen states nobody meant to save, and the day header
  // and the timeline both re-render off each one.
  function commitTitle() {
    if (title.trim() && title.trim() !== task.title) actions.setTaskTitle(date, task.id, title)
    else setTitle(task.title)
  }

  function commitSize() {
    const parsed = parseMinutesInput(size)
    actions.setTaskMinutes(date, task.id, parsed)
    setSize(parsed !== undefined ? String(parsed) : '')
  }

  /**
   * Swipe down to close, from the grab bar only.
   *
   * The bar rather than the whole sheet: the body scrolls, and a sheet that
   * closes on any downward drag closes every time somebody scrolls back up
   * past the top of a long form. The bar is the one strip with nothing else
   * to do, which is what it is drawn for.
   *
   * A quarter of the sheet's own height is the commit distance, so it scales
   * with the sheet rather than being a magic number tuned on one phone.
   */
  function onGrabPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    const bar = e.currentTarget as HTMLElement
    const panel = panelRef.current
    if (!panel) return
    bar.setPointerCapture(e.pointerId)
    const startY = e.clientY
    const threshold = Math.max(80, panel.getBoundingClientRect().height / 4)
    let pulled = 0

    function move(ev: PointerEvent) {
      pulled = Math.max(0, ev.clientY - startY)
      setPullY(pulled)
    }
    function end() {
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', end)
      bar.removeEventListener('pointercancel', end)
      setPullY(0)
      if (pulled > threshold) onClose()
    }
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', end)
    bar.addEventListener('pointercancel', end)
  }

  function nudge(byMinutes: number) {
    if (!task.time) return
    actions.setTaskTime(date, task.id, stepTime(task.time, byMinutes))
  }

  return (
    <div className="task-detail-scrim" onClick={onClose}>
      <div
        className="task-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={pullY > 0 ? { transform: `translateY(${pullY}px)`, transition: 'none' } : undefined}
      >
        {/* Only visible at the phone breakpoint, where this is a bottom
            sheet - see styles.css. aria-hidden because closing is already a
            real, focusable button beside the title; this is the gesture, not
            a second control to find. */}
        <div className="task-detail-grab" aria-hidden="true" onPointerDown={onGrabPointerDown}>
          <span />
        </div>
        <div className="task-detail-head">
          <h2 id={titleId} className="visually-hidden">
            {task.title}
          </h2>
          <input
            className="task-detail-title"
            aria-label="Task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <button type="button" className="task-detail-close" aria-label="Close details" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="task-detail-body">
          {/* Time. The picker for a jump, the two nudges for the far more
              common case - it starts a bit later than planned, and nobody
              wants to open a dropdown to say so. */}
          <div className="task-detail-field">
            <span className="task-detail-label">Time</span>
            <div className="task-detail-time">
              <TimePicker
                value={task.time ?? ''}
                ariaLabel="Task time"
                onChange={next => actions.setTaskTime(date, task.id, next || undefined)}
              />
              <button type="button" className="task-detail-nudge" disabled={!task.time} onClick={() => nudge(-5)}>
                &minus;5
              </button>
              <button type="button" className="task-detail-nudge" disabled={!task.time} onClick={() => nudge(5)}>
                +5
              </button>
              {task.time && (
                <button
                  type="button"
                  className="task-detail-clear"
                  onClick={() => actions.setTaskTime(date, task.id, undefined)}
                >
                  No set time
                </button>
              )}
            </div>
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Size</span>
            <div className="task-detail-time">
              <input
                className="task-detail-size"
                inputMode="numeric"
                aria-label="Size in minutes"
                placeholder="min"
                value={size}
                onChange={e => setSize(e.target.value)}
                onBlur={commitSize}
                onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              {task.minutes !== undefined && (
                <span className="task-detail-hint">{formatDuration(task.minutes)}</span>
              )}
            </div>
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Category</span>
            <div className="category-picker" role="group" aria-label="Category">
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === task.category ? 'category-swatch selected' : 'category-swatch'}
                  style={{ ['--cat' as string]: categoryColor(c.id) } as React.CSSProperties}
                  aria-pressed={c.id === task.category}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => actions.setTaskCategory(date, task.id, c.id)}
                />
              ))}
            </div>
          </div>

          {/* The cap is stated on the control itself, not discovered by
              being refused. See actions.toggleTaskHighlight for why it
              refuses rather than swapping the oldest out. */}
          <div className="task-detail-field">
            <span className="task-detail-label">Key task</span>
            <div className="task-detail-time">
              <button
                type="button"
                className={task.highlight ? 'task-detail-toggle active' : 'task-detail-toggle'}
                aria-pressed={task.highlight ?? false}
                disabled={highlightFull}
                onClick={() => actions.toggleTaskHighlight(date, task.id)}
              >
                {task.highlight ? 'A key task today' : 'Mark as key'}
              </button>
              <span className="task-detail-hint">
                {highlights}/{MAX_HIGHLIGHTS} used
                {highlightFull ? ' - unmark another first' : ''}
              </span>
            </div>
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Repeats</span>
            <select
              aria-label="Repeats"
              value={task.repeat ?? ''}
              onChange={e =>
                actions.setTaskRepeat(date, task.id, (e.target.value || undefined) as Repeat | undefined, scope)
              }
            >
              {REPEATS.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {/* Only once a task is genuinely part of a series. Asked before
                the change rather than after it, as a standing choice rather
                than a dialog: a confirmation that appears every single time
                you touch a repeating task is a confirmation people learn to
                dismiss without reading. */}
            {inSeries && (
              <div className="segmented task-detail-scope" role="group" aria-label="Changes apply to">
                <button
                  type="button"
                  className={scope === 'series' ? 'active' : ''}
                  aria-pressed={scope === 'series'}
                  onClick={() => setScope('series')}
                >
                  Every day it repeats
                </button>
                <button
                  type="button"
                  className={scope === 'day' ? 'active' : ''}
                  aria-pressed={scope === 'day'}
                  onClick={() => setScope('day')}
                >
                  Just this day
                </button>
              </div>
            )}
          </div>

          {inSeries && (
            <div className="task-detail-field">
              <span className="task-detail-label">Remove</span>
              <div className="task-detail-time">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    actions.deleteTask(date, task.id, scope)
                    onClose()
                  }}
                >
                  {scope === 'series' ? 'Delete from every day' : 'Delete from this day'}
                </button>
                <span className="task-detail-hint">
                  {scope === 'series'
                    ? 'Days already lived keep it - only this one and the ones ahead lose it.'
                    : 'It stops coming back on this day, and nowhere else changes.'}
                </span>
              </div>
            </div>
          )}

          {/* Only offered once there is a library to bind to, the same rule
              the sleep schedule picker follows. */}
          {library.length > 0 && (
            <div className="task-detail-field">
              <span className="task-detail-label">From the library</span>
              <div className="task-detail-time">
                <select
                  aria-label="Library item"
                  value={task.libraryRef ? `${task.libraryRef.listId}:${task.libraryRef.itemId}` : ''}
                  onChange={e => {
                    const [listId, itemId] = e.target.value.split(':')
                    actions.setTaskLibraryRef(date, task.id, listId && itemId ? { listId, itemId } : undefined)
                  }}
                >
                  <option value="">Not from a list</option>
                  {library.map(list => (
                    <optgroup key={list.id} label={list.name}>
                      {list.items
                        .filter(i => i.finished === undefined)
                        .map(item => (
                          <option key={item.id} value={`${list.id}:${item.id}`}>
                            {item.title}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {boundList && boundItem && (
                  <span className="task-detail-hint">
                    {progressLabel(boundList, boundItem)}
                    {progressPercent(boundItem) !== undefined ? ` - ${progressPercent(boundItem)}%` : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sub-steps, not tasks: no time, no size, never on the timeline.
              The moment they can be scheduled apart they stop being a way of
              starting one thing and become three more things to plan. */}
          <div className="task-detail-field">
            <span className="task-detail-label">
              Steps{subtasks.length > 0 ? ` ${doneSubtasks}/${subtasks.length}` : ''}
            </span>
            <div className="task-detail-subtasks">
              {subtasks.map(sub => (
                <label key={sub.id} className={sub.done ? 'subtask done' : 'subtask'}>
                  <input
                    type="checkbox"
                    checked={sub.done}
                    aria-label={sub.title}
                    onChange={() => actions.toggleSubtask(date, task.id, sub.id)}
                  />
                  <span className="check" aria-hidden="true" />
                  <span className="subtask-title">{sub.title}</span>
                  <button
                    type="button"
                    className="subtask-remove"
                    aria-label={`Remove step ${sub.title}`}
                    onClick={() => actions.deleteSubtask(date, task.id, sub.id)}
                  >
                    &times;
                  </button>
                </label>
              ))}
              <input
                className="subtask-add"
                placeholder="Add a step"
                aria-label="Add a step"
                value={subtaskDraft}
                onChange={e => setSubtaskDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  actions.addSubtask(date, task.id, subtaskDraft)
                  setSubtaskDraft('')
                }}
              />
            </div>
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Note</span>
            <textarea
              className="task-detail-note"
              aria-label="Note"
              rows={3}
              placeholder="Anything worth remembering when this comes round"
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={() => actions.setTaskNote(date, task.id, note)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
