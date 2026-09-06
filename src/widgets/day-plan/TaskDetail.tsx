import { useEffect, useId, useRef, useState } from 'react'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { actions, useAppData } from '../../lib/store'
import { resolvedColor } from '../../lib/categories'
import { progressLabel, progressPercent } from '../../lib/library'
import { scratchTitle } from '../../lib/scratch'
import { MAX_HIGHLIGHTS, type LibraryList, type Repeat, type Task } from '../../lib/types'
import { TimePicker } from '../../views/TimePicker'
import { MinuteStepInput } from '../../views/MinuteStepInput'
import { DurationChips } from '../../views/DurationControl'
import { Explain } from '../../views/Explain'
import { clockTools, useClockTools } from '../../lib/clockTools'
import { formatDuration, stepTime } from './capacity'

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
  /**
   * Deletes a task that is not part of a series - the day's own delete,
   * which carries the undo offer. Optional so a caller with nothing to do
   * about it draws the sheet without a Delete; a task in a series deletes
   * itself through the store with its scope, as it always did.
   */
  onDelete?: (taskId: string) => void
  /**
   * Opens the note this task was made from, when there is one. The note is
   * where its pictures live - see `scratchToTaskKeepingNote` - so this is
   * the way to a meal plan screenshot from the task that came out of it.
   */
  onOpenNote?: (noteId: string) => void
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
export function TaskDetail({ task, tasks, date, library, onClose, onDelete, onOpenNote }: TaskDetailProps) {
  useRestoreFocus()
  const data = useAppData()
  const panelRef = useRef<HTMLDivElement>(null)
  // How far the sheet has been pulled down, in pixels. Only ever non-zero
  // during a drag on the grab bar - see onGrabPointerDown.
  const [pullY, setPullY] = useState(0)
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note ?? '')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  // Which of the two a change means, held while the sheet is open. Defaults
  // to the series, because that is what somebody who set up a repeat almost
  // always means - the exception is the exception.
  const [scope, setScope] = useState<'day' | 'series'>('series')
  const titleId = useId()
  // Which step the timer is running for, if it is this task's - so the
  // step's own button can say so rather than offering to start it again.
  const runningStep = useClockTools().timer?.step

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
  // The note this task came from, if the note is still in the stream: a
  // deleted note leaves the task alone rather than the task carrying a dead
  // link, which is the same rule every reference in this state follows.
  const fromNote = task.fromNote ? data.scratch.find(n => n.id === task.fromNote) : undefined

  const scopeHint =
    scope === 'series'
      ? 'Days already lived keep it - only this one and the ones ahead change.'
      : 'This day changes, and nowhere else does.'

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
        /* A modal the tour may have led somebody into. If the next step's
           control is not inside it, the engine points at the close button
           and says so - see views/tour/Tour.tsx. */
        data-tour-modal=""
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
          <button
            type="button"
            className="task-detail-close"
            aria-label="Close details"
            data-tour-modal-close=""
            onClick={onClose}
          >
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

          {/* The number, and the six lengths a task usually is beside it:
              a chip is one press where the box is arithmetic, and the box
              stays for the seventh length. Both write the same field. The
              number carries its unit and nothing repeats it: a "2h" beside
              "120" read as the same size said twice. */}
          <div className="task-detail-field">
            <span className="task-detail-label">Size</span>
            <div className="task-detail-time">
              <MinuteStepInput
                value={task.minutes === undefined ? '' : String(task.minutes)}
                ariaLabel="Size in minutes"
                unit="min"
                onChange={next => actions.setTaskMinutes(date, task.id, next === '' ? undefined : Number(next))}
              />
            </div>
            <DurationChips minutes={task.minutes} onChange={minutes => actions.setTaskMinutes(date, task.id, minutes)} label="Size" />
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Category</span>
            <div className="category-picker" role="group" aria-label="Category">
              {data.categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === task.category ? 'category-swatch selected' : 'category-swatch'}
                  style={{ ['--cat' as string]: resolvedColor(c) } as React.CSSProperties}
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
              <Explain id="key-task">
                <button
                  type="button"
                  className={task.highlight ? 'task-detail-toggle active' : 'task-detail-toggle'}
                  data-tour="key"
                  aria-pressed={task.highlight ?? false}
                  disabled={highlightFull}
                  onClick={() => actions.toggleTaskHighlight(date, task.id)}
                >
                  {task.highlight ? 'A key task today' : 'Mark as key'}
                </button>
              </Explain>
              <span className="task-detail-hint">
                {highlights}/{MAX_HIGHLIGHTS} used
                {highlightFull ? ' - unmark another first' : ''}
              </span>
            </div>
          </div>

          <div className="task-detail-field">
            <span className="task-detail-label">Repeats</span>
            {/* Four named shapes as buttons, not a dropdown: every answer is
                on screen, and one press is the whole of choosing. */}
            <div className="segmented" role="group" aria-label="Repeats">
              {REPEATS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={(task.repeat ?? '') === r.value ? 'active' : ''}
                  aria-pressed={(task.repeat ?? '') === r.value}
                  onClick={() => actions.setTaskRepeat(date, task.id, (r.value || undefined) as Repeat | undefined, scope)}
                >
                  {r.label}
                </button>
              ))}
            </div>
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
            {inSeries && <span className="task-detail-hint">{scopeHint}</span>}
          </div>

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
                  {/* A step with a length carries the timer for it: one tap
                      and the app's own timer runs for that long, ticking the
                      step when it rings. Inside the label, but a button is
                      interactive content and a press on it is not a press on
                      the box; stopped besides, so nothing above hears it. */}
                  {sub.minutes !== undefined && (
                    <button
                      type="button"
                      className={
                        runningStep?.subtaskId === sub.id && runningStep.taskId === task.id ? 'subtask-timer is-running' : 'subtask-timer'
                      }
                      aria-label={`Start a ${formatDuration(sub.minutes)} timer for ${sub.title}`}
                      title="Starts the timer for this step"
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        clockTools.startTimer(sub.minutes! * 60_000, { date, taskId: task.id, subtaskId: sub.id })
                      }}
                    >
                      {formatDuration(sub.minutes)}
                    </button>
                  )}
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
                placeholder="Add a step, or one with a length: Meditation 10 min"
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

          {/* A task made from a note keeps the way back to it, because the
              note is where its pictures are - a meal plan screenshot is
              reachable from the task it turned into, without a copy of it
              existing anywhere. See scratchToTaskKeepingNote. */}
          {fromNote && (
            <div className="task-detail-field">
              <span className="task-detail-label">From a note</span>
              <button type="button" className="task-detail-fromnote" onClick={() => onOpenNote?.(fromNote.id)}>
                {scratchTitle(fromNote.text, 60) || 'A note with a picture'}
                {fromNote.photos && fromNote.photos.length > 0 && (
                  <span className="task-detail-fromnote-count">
                    {fromNote.photos.length === 1 ? '1 picture' : `${fromNote.photos.length} pictures`}
                  </span>
                )}
              </button>
            </div>
          )}

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

        {/* The way out and the way to be rid of it, outside the scrolling
            body so both are on screen whatever the sheet holds. The sheet
            saves as it goes - every field writes on change or on blur - so
            Done is not Save: it is the button that says the person is
            finished here, which a sheet with no ending made people look for.
            Delete was a Remove section at the bottom of a body that scrolled,
            and only for a repeating task; a plain task's delete was two menus
            away. A task in a series still deletes with its scope, and the
            scope's own line above says what that reaches. */}
        <div className="task-detail-foot">
          {inSeries ? (
            <button
              type="button"
              className="btn-danger"
              title={scopeHint}
              onClick={() => {
                actions.deleteTask(date, task.id, scope)
                onClose()
              }}
            >
              {scope === 'series' ? 'Delete from every day' : 'Delete from this day'}
            </button>
          ) : (
            onDelete && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  onDelete(task.id)
                  onClose()
                }}
              >
                Delete
              </button>
            )
          )}
          <button type="button" className="btn-primary task-detail-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
