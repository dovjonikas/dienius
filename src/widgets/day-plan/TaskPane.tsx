import { useId, useState } from 'react'
import type { LibraryList, Task } from '../../lib/types'
import { actions, useAppData } from '../../lib/store'
import { todayKey } from '../../lib/dates'
import { isFirstRun } from '../../lib/onboarding'
import { enterDemoMode, isDemoMode } from '../../lib/demoMode'
import { startTour } from '../../lib/tourState'
import { useIsWide } from '../../lib/viewport'
import { starterTemplateInput, type StarterTemplate } from '../../lib/starterTemplates'
import { clockTools } from '../../lib/clockTools'
import { parseMinutesInput } from './capacity'
import { rolloverSplit } from './rollover'
import { StarterOffers } from '../onboarding/StarterOffers'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'
import { Inbox } from './Inbox'

/**
 * The task column: capturing something, the list of what is on the day, what
 * is already finished, and what happens to the leftovers.
 *
 * What is left in here is the column itself - the list, the Done fold, the
 * inbox under it, the rollover button at the bottom, and which row is having
 * its size edited. Capture is its own component (QuickAdd), because the time
 * control, the text and the duration control are one feature that has to
 * behave identically wherever it appears and is what the tour points at.
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
  const [sizeEditingId, setSizeEditingId] = useState<string | null>(null)
  const [sizeDraft, setSizeDraft] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)
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
  const isWide = useIsWide()
  const { pushable, held, covered } = rolloverSplit(data, date, tasks)


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
      <QuickAdd date={date} tasks={tasks} />

      {tasks.length === 0 && firstRun && (
        <div className="first-run">
          <p className="first-run-lede">
            Dienius plans a day from a template: a reusable set of blocks you stamp onto a date instead
            of retyping it every morning. Tap one below to add it as a real template and set up today -
            edit or delete it any time afterward.
          </p>
          {/* The other way in, for somebody who would rather look than build.
              Offered here rather than as a first screen: an app that asks
              "demo or real?" before showing anything is asking a question you
              cannot answer yet. Its own key, thrown away on the way out - see
              demoMode.ts. */}
          {/* The tour: nine real actions on this very plan, two minutes.
              Offered before the starters because it starts by tapping one
              of them - and a person who takes it has, by the end, planned a
              day, which is what this screen is for. */}
          <p className="first-run-tour">
            <button type="button" className="btn-primary" onClick={() => startTour(isWide ? 'desktop' : 'mobile')}>
              Show me around
            </button>
            <span className="muted">Two minutes. Every step is a real action, and you keep what you make.</span>
          </p>
          {!isDemoMode() && (
            <p className="first-run-demo">
              Not sure yet?{' '}
              <button type="button" className="link-button" onClick={enterDemoMode}>
                Try it with a sample week
              </button>{' '}
              - a fortnight of somebody's real-looking days, kept entirely separate from yours.
            </p>
          )}
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
