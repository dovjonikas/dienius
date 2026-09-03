import { useId, useState } from 'react'
import type { LibraryList, Task } from '../../lib/types'
import { actions, getData, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { isFirstRun } from '../../lib/onboarding'
import { starterTemplateInput, type StarterTemplate } from '../../lib/starterTemplates'
import { clockTools } from '../../lib/clockTools'
import { CATEGORIES, DEFAULT_CATEGORY, categoryColor, categoryLabel, type CategoryId } from '../../lib/categories'
import { clearDraft, consumeDraft, saveDraft } from './draft'
import { parseQuickAdd } from './parse'
import { formatDuration, parseMinutesInput } from './capacity'
import { rolloverSplit } from './rollover'
import { StarterOffers } from '../onboarding/StarterOffers'
import { TaskRow } from './TaskRow'
import { Inbox } from './Inbox'

/**
 * The task column: capturing something, the list of what is on the day, what
 * is already finished, and what happens to the leftovers.
 *
 * Everything the tray owns on its own lives here - the quick-add's text, which
 * of the two things Enter does, which category the next task gets, which row
 * is having its size edited. None of that means anything outside this column,
 * and DayView held it only because this markup used to be inline.
 */

export interface TaskPaneProps {
  date: string
  /** Every task on the day, already sorted. */
  tasks: Task[]
  /** Mid-animation on its way to Done - see useDoneAnimation. */
  leavingId: string | null
  isFullDay: boolean
  library: LibraryList[]
  runningTaskId: string | undefined
  runningLeft: number | undefined
  selectedTaskId: string | null
  taskListRef: React.RefObject<HTMLUListElement | null>
  onToggleSelect: (taskId: string) => void
  onToggleDone: (taskId: string, wasDone: boolean) => void
  onOpenActions: (taskId: string) => void
  onOpenDetails: (taskId: string) => void
  onContextMenu: (taskId: string, x: number, y: number) => void
}

export function TaskPane({
  date,
  tasks,
  leavingId,
  isFullDay,
  library,
  runningTaskId,
  runningLeft,
  selectedTaskId,
  taskListRef,
  onToggleSelect,
  onToggleDone,
  onOpenActions,
  onOpenDetails,
  onContextMenu,
}: TaskPaneProps) {
  const data = useAppData()
  const [input, setInput] = useState(() => consumeDraft(date))
  const [sizeEditingId, setSizeEditingId] = useState<string | null>(null)
  const [sizeDraft, setSizeDraft] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)
  // Which category the next quick-added task gets. Session state, not stored:
  // it follows what you are doing right now, and the point of a default is
  // that most tasks typed in one sitting belong together - carrying that
  // across days would be a guess about tomorrow instead.
  const [newCategory, setNewCategory] = useState<CategoryId>(DEFAULT_CATEGORY)
  // Which of the two things Enter does. A mode rather than a second field: one
  // input with one cursor, and the thing being typed goes wherever the toggle
  // says, so capturing costs a tap once rather than a decision every time
  // about which box to aim at.
  const [captureMode, setCaptureMode] = useState<'task' | 'inbox'>('task')
  const doneListId = useId()

  // The open list and the Done section, split from the one sorted list rather
  // than sorted differently - sortTasks stays the single source of order within
  // each. A task mid-animation counts as still open, which is what keeps it
  // drawn in place while its card plays out.
  const openTasks = tasks.filter(t => !t.done || t.id === leavingId)
  const doneTasks = tasks.filter(t => t.done && t.id !== leavingId)

  const isPast = date < todayKey()
  // Derived straight from the data itself, not a stored flag - see
  // docs/DECISIONS.md, "offer without installing." True only while there is
  // genuinely nothing here yet: no template ever saved, no day that ever held
  // a real task.
  const firstRun = isFirstRun(data)
  const { pushable, held, covered } = rolloverSplit(data, date, tasks)

  // Re-parsed on every keystroke. Cheap - one regex pass over a short string -
  // and the alternative (parsing only on Enter) is what the chips exist to fix.
  const draft = parseQuickAdd(input)

  function handleUseStarter(starter: StarterTemplate) {
    // One tap does both things the offer promises: a real, editable template
    // gets added to the templates list, and it is stamped onto the exact day
    // being viewed - so tapping an offer on an empty day leaves that day
    // genuinely planned, not just a template sitting unused elsewhere.
    // actions.stamp reuses the same path the calendar's own stamp bar already
    // commits through, not a second way to fill a day's tasks in.
    const template = actions.addTemplate(starterTemplateInput(starter))
    actions.stamp({ [date]: template.id })
  }

  function handleAdd() {
    if (captureMode === 'inbox') {
      // Straight in, exactly as typed - no parsing, because an inbox item is
      // not a task yet and a time or a duration in it is just part of the note
      // somebody wrote to themselves.
      if (!input.trim()) return
      actions.addInboxItem(input)
      setInput('')
      clearDraft()
      return
    }
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, parsed.time, newCategory)
    if (parsed.minutes !== undefined) {
      const added = getData().days[date]?.tasks.at(-1)
      if (added) actions.setTaskMinutes(date, added.id, parsed.minutes)
    }
    setInput('')
    clearDraft()
  }

  function handleInputChange(text: string) {
    setInput(text)
    saveDraft(date, text)
  }

  function startSizeEdit(task: { id: string; minutes?: number }) {
    setSizeEditingId(task.id)
    setSizeDraft(task.minutes !== undefined ? String(task.minutes) : '')
  }

  function commitSizeEdit(taskId: string) {
    const trimmed = sizeDraft.trim()
    if (trimmed === '') {
      actions.setTaskMinutes(date, taskId, undefined)
    } else {
      const parsed = parseMinutesInput(sizeDraft)
      // A non-empty value that does not parse is left untouched rather than
      // clearing a size that was already there - a stray keystroke should not
      // silently erase a real estimate.
      if (parsed !== undefined) actions.setTaskMinutes(date, taskId, parsed)
    }
    setSizeEditingId(null)
  }

  function cancelSizeEdit(task: Task) {
    // Restore the draft to what it was before this edit started, so that if
    // the browser still fires a blur as this input unmounts, the commit it
    // triggers is a harmless no-op rather than saving whatever was left
    // half-typed.
    setSizeDraft(task.minutes !== undefined ? String(task.minutes) : '')
    setSizeEditingId(null)
  }

  /** The props every row gets the same way, open or done. */
  function rowProps(task: Task) {
    return {
      task,
      isFullDay,
      sizeEditingId,
      sizeDraft,
      onStartSizeEdit: startSizeEdit,
      onSizeDraftChange: setSizeDraft,
      onCommitSizeEdit: commitSizeEdit,
      onCancelSizeEdit: cancelSizeEdit,
      onToggleDone,
      onOpenActions: () => onOpenActions(task.id),
      onOpenDetails: () => onOpenDetails(task.id),
      onContextMenu: (x: number, y: number) => onContextMenu(task.id, x, y),
      library,
      selected: selectedTaskId === task.id,
      onToggleSelect: () => onToggleSelect(task.id),
    }
  }

  return (
    // data-tray-zone marks where a block dropped from the grid means "this has
    // no time any more". It used to sit on the whole day view, which made every
    // square pixel of the screen the tray - fine while releasing a block was
    // the only thing a drag could do, and wrong the moment dragging one could
    // also move it in time. It is the task column, which is what the gesture
    // was always described as: drag it back to the list.
    <div className="task-pane" data-tray-zone>
      <div className="quick-add-block">
        <div className="capture-mode segmented" role="group" aria-label="What Enter does">
          <button
            type="button"
            className={captureMode === 'task' ? 'active' : ''}
            aria-pressed={captureMode === 'task'}
            onClick={() => setCaptureMode('task')}
          >
            Task
          </button>
          <button
            type="button"
            className={captureMode === 'inbox' ? 'active' : ''}
            aria-pressed={captureMode === 'inbox'}
            onClick={() => setCaptureMode('inbox')}
          >
            Inbox
          </button>
        </div>
        <input
          className="quick-add"
          /* Marked rather than reached by a ref chain from the shell: the N
             shortcut lives at the app root and has no business knowing this
             view's internals - see App.tsx. */
          data-quick-add=""
          placeholder={captureMode === 'inbox' ? 'Catch a thought, decide later...' : 'Add a task... try 14:00 Call mom'}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        {/* What the line was understood as, live, before Enter is pressed.
            Quick-add accepts a leading time and a trailing duration inside
            ordinary prose, which is fast to type and impossible to be sure of -
            "Read 20 pages" must keep its 20 and "Read 20 min" must not. Showing
            the parse removes the doubt at the moment it exists, which is
            cheaper than an error afterwards. Nothing here is a control: it is
            the input describing itself. */}
        {draft && captureMode === 'task' && (
          <div className="quick-add-chips" aria-live="polite">
            {draft.time && <span className="quick-add-chip is-time">{draft.time}</span>}
            {draft.minutes !== undefined && (
              <span className="quick-add-chip is-size">{formatDuration(draft.minutes)}</span>
            )}
            <span
              className="quick-add-chip is-cat"
              style={{ ['--cat' as string]: categoryColor(newCategory) } as React.CSSProperties}
            >
              {categoryLabel(newCategory)}
            </span>
            <span className="quick-add-chip-title">{draft.title}</span>
          </div>
        )}

        {/* Which colour the next task gets, chosen before typing rather than
            asked about afterward - six swatches is one glance and one tap,
            where a follow-up dialog would be a second decision at exactly the
            moment the thought is meant to be leaving your head. Each is a real
            toggle button carrying its own name, so the choice is reachable and
            readable without relying on the colour. */}
        {captureMode === 'task' && (
          <div className="category-picker" role="group" aria-label="Category for the next task">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                className={c.id === newCategory ? 'category-swatch selected' : 'category-swatch'}
                style={{ ['--cat' as string]: c.color } as React.CSSProperties}
                aria-pressed={c.id === newCategory}
                aria-label={c.label}
                title={c.label}
                onClick={() => setNewCategory(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {tasks.length === 0 && firstRun && (
        <div className="first-run">
          <p className="first-run-lede">
            Dienius plans a day from a template: a reusable set of blocks you stamp onto a date instead
            of retyping it every morning. Tap one below to add it as a real template and set up today -
            edit or delete it any time afterward.
          </p>
          <StarterOffers onUse={handleUseStarter} />
          <p className="first-run-note">
            Dark, Light and Midnight are all under Settings, along with an accent colour and how
            spacious you want everything.
          </p>
        </div>
      )}
      {tasks.length === 0 && !firstRun && (
        <div className="empty-state">
          <span className="empty-state-mark" aria-hidden="true" />
          <p className="empty-state-title">{isPast ? 'Nothing planned' : 'Nothing planned yet'}</p>
          <p className="empty-state-note">
            {isPast
              ? 'This day went by without a plan. That is allowed.'
              : 'Tap a template on the left to lay out the whole day, or type the first thing above.'}
          </p>
        </div>
      )}

      {/* Everything on the day is finished. Worth its own state rather than an
          empty list: an empty list looks like a day that was never planned, and
          this is the opposite of that. Nothing here suggests adding more - the
          quick-add above is right there for anyone who wants to, and a planner
          that answers "you are done" with "here is what else you could do" is
          one people stop finishing days in. */}
      {openTasks.length === 0 && doneTasks.length > 0 && (
        <div className="empty-state empty-state-cleared">
          <span className="empty-state-check" aria-hidden="true" />
          <p className="empty-state-title">Day cleared</p>
          <p className="empty-state-note">
            {doneTasks.length === 1 ? 'One task, finished.' : `All ${doneTasks.length} tasks, finished.`}
          </p>
        </div>
      )}

      <ul className="task-list" ref={taskListRef} tabIndex={-1}>
        {openTasks.map(task => (
          <TaskRow
            key={task.id}
            {...rowProps(task)}
            leaving={task.id === leavingId}
            active={task.id === runningTaskId}
            minutesLeft={task.id === runningTaskId ? runningLeft : undefined}
            onFocus={() => clockTools.startFocus(date, task.id)}
          />
        ))}
      </ul>

      {/* Everything already finished, folded away behind one line. This is the
          payoff for the checkbox interaction above rather than a filing
          cabinet: the open list only ever gets shorter as the day goes, so by
          evening the screen is nearly empty and the bar in the header is nearly
          full - which is the whole shape of the day in one glance, with no
          counting.

          A plain aria-expanded disclosure whose panel is collapsed in CSS
          (display: none, see styles.css) rather than unmounted. Unmounting is
          this app's usual choice for a disclosure, and it is the right one
          where the hidden thing is expensive or would be confusing to leave in
          the page. Neither applies here: these rows are already rendered work,
          and display: none removes them from the accessibility tree just as
          completely as unmounting would, while keeping the whole day's list in
          the DOM for anything - find on page, an export, a browser's own search
          - that reasonably expects a task not to disappear from the document
          just because it was finished. */}
      {doneTasks.length > 0 && (
        <div className={doneOpen ? 'done-section open' : 'done-section'}>
          <button
            type="button"
            className="done-toggle"
            aria-expanded={doneOpen}
            aria-controls={doneListId}
            onClick={() => setDoneOpen(open => !open)}
          >
            <span className="done-caret" aria-hidden="true" />
            Done
            <span className="inbox-badge">{doneTasks.length}</span>
          </button>
          <ul className="task-list task-list-done" id={doneListId}>
            {doneTasks.map(task => (
              <TaskRow key={task.id} {...rowProps(task)} />
            ))}
          </ul>
        </div>
      )}

      {/* Everything caught and not yet decided about - see Inbox.tsx. Under the
          Done fold, because both are places things go rather than places work
          happens, and the open list stays the only thing above them. */}
      <Inbox date={date} />

      {pushable > 0 && (
        <button className="rollover" onClick={() => actions.rolloverUnfinished(date)}>
          {/* A real arrow, drawn in CSS rather than loaded as an icon or pasted
              in as an emoji - see the checkbox tick and the Done caret for the
              same approach. Decorative: the button's own words already say
              where things are going. */}
          <span className="rollover-icon" aria-hidden="true" />
          {held > 0 ? `Push ${pushable} to tomorrow - ${held} staying here` : `Push ${pushable} to tomorrow`}
        </button>
      )}
      {/* Said out loud rather than left as a silent skip: "seven of your nine
          did not move" is a surprising thing for a button to do without
          mentioning it. Any one of them can still be moved by hand from its own
          detail sheet. */}
      {covered > 0 && (
        <p className="rollover-note">
          {covered} routine {covered === 1 ? 'task stays' : 'tasks stay'} - tomorrow has{' '}
          {covered === 1 ? 'it' : 'them'} anyway.
        </p>
      )}
      {pushable === 0 && held > 0 && (
        <p className="rollover-note">Nothing left to push - the rest are waiting on a decision.</p>
      )}
    </div>
  )
}
