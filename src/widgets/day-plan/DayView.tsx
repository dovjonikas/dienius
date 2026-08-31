import { useState } from 'react'
import { actions, MAX_PUSHES, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { clearDraft, consumeDraft, saveDraft } from './draft'
import { parseQuickAdd } from './parse'
import { sortTasks } from './sort'
import { dayScore, formatDayScore } from './score'
import { computeCapacity, formatCapacityLine, formatDuration, parseMinutesInput } from './capacity'
import { TimelineGrid } from './TimelineGrid'

const PUSH_COUNT_WORDS: Record<number, string> = { 1: 'once', 2: 'twice' }

function pushCountLabel(count: number): string {
  return PUSH_COUNT_WORDS[count] ?? `${count} times`
}

export interface DayViewProps {
  date: string
  onDateChange: (date: string) => void
}

export function DayView({ date, onDateChange }: DayViewProps) {
  const data = useAppData()
  const [input, setInput] = useState(() => consumeDraft(date))
  const [sizeEditingId, setSizeEditingId] = useState<string | null>(null)
  const [sizeDraft, setSizeDraft] = useState('')
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId
    ? data.templates.find(t => t.id === day.templateId)
    : undefined
  const unfinishedTasks = tasks.filter(t => !t.done)
  const pushableCount = unfinishedTasks.filter(t => (t.pushCount ?? 0) < MAX_PUSHES).length
  const heldCount = unfinishedTasks.length - pushableCount
  const isToday = date === todayKey()
  const isFullDay = (day?.dayType ?? 'full') === 'full'
  const score = dayScore(day?.tasks ?? [], day?.dayType)
  const formattedScore = formatDayScore(score)
  const scoreLabel = score.planned
    ? isFullDay
      ? `${score.done} of ${score.total} done`
      : `${score.done} of ${score.total} core tasks done`
    : undefined

  const capacity = computeCapacity(day?.tasks ?? [], day?.dayType)
  const capacityLine = formatCapacityLine(capacity)

  function handleAdd() {
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, parsed.time)
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
      // A non-empty value that does not parse is left untouched rather
      // than clearing a size that was already there - a stray keystroke
      // should not silently erase a real estimate.
      if (parsed !== undefined) actions.setTaskMinutes(date, taskId, parsed)
    }
    setSizeEditingId(null)
  }

  return (
    <section className="day-view">
      <div className="day-nav">
        <button aria-label="Previous day" onClick={() => onDateChange(addDays(date, -1))}>
          &larr;
        </button>
        <div className="day-title">
          <h2>{isToday ? 'Today' : formatDayTitle(date)}</h2>
          {isToday && <span className="day-subtitle">{formatDayTitle(date)}</span>}
          {formattedScore && (
            <span className="day-score">
              <span aria-hidden="true">
                {formattedScore}
                {!isFullDay && <span className="day-score-note"> core</span>}
              </span>
              <span className="visually-hidden">{scoreLabel}</span>
            </span>
          )}
          {template && (
            <span className="day-template" style={{ background: template.color }}>
              {template.name}
            </span>
          )}
        </div>
        <button aria-label="Next day" onClick={() => onDateChange(addDays(date, 1))}>
          &rarr;
        </button>
      </div>

      {/* Purely informational - no embedded action. Being over is stated as
          a fact; which float moves to tomorrow, if any, is decided on that
          float's own row below, not pre-selected here. See
          docs/TIMELINE.md section 8. */}
      {capacityLine && (
        <div className="capacity-line">
          <p>{capacityLine}</p>
        </div>
      )}

      <TimelineGrid
        tasks={day?.tasks ?? []}
        templateColor={template?.color}
        onPlaceFloat={(taskId, time) => actions.placeFloat(date, taskId, time)}
      />

      <input
        className="quick-add"
        placeholder="Add a task... try 14:00 Call mom"
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />

      {tasks.length === 0 && <p className="empty">Nothing planned. Add a task above or stamp a template from the calendar.</p>}

      <ul className="task-list">
        {tasks.map(task => {
          const pushCount = task.pushCount ?? 0
          const atBound = !task.done && pushCount >= MAX_PUSHES
          const classNames = ['task']
          if (task.done) classNames.push('done')
          if (atBound) classNames.push('task-maxed')
          const badgeId = `push-badge-${task.id}`
          const noteId = `push-note-${task.id}`
          const coreId = `core-badge-${task.id}`
          const showCoreBadge = !isFullDay && !!task.core
          const describedByIds = [
            atBound ? noteId : pushCount > 0 ? badgeId : undefined,
            showCoreBadge ? coreId : undefined,
          ].filter((id): id is string => !!id)
          const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined
          return (
            <li key={task.id} className={classNames.join(' ')}>
              <div className="task-row">
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label={task.title}
                    aria-describedby={describedBy}
                    onChange={() => actions.toggleTask(date, task.id)}
                  />
                  <span className="check" aria-hidden="true" />
                  {task.time && <span className="task-time">{task.time}</span>}
                  <span className="task-title">{task.title}</span>
                  {showCoreBadge && (
                    <span id={coreId} className="task-core">core</span>
                  )}
                  {pushCount > 0 && !atBound && (
                    <span id={badgeId} className="task-pushed">pushed {pushCountLabel(pushCount)}</span>
                  )}
                </label>
                {sizeEditingId === task.id ? (
                  <input
                    className="task-size-input"
                    inputMode="numeric"
                    aria-label={`Size in minutes for ${task.title}`}
                    value={sizeDraft}
                    autoFocus
                    onChange={e => setSizeDraft(e.target.value)}
                    onBlur={() => commitSizeEdit(task.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitSizeEdit(task.id)
                      if (e.key === 'Escape') {
                        // Restore the draft to what it was before this edit
                        // started, so that if the browser still fires a
                        // blur as this input unmounts, the commit it
                        // triggers is a harmless no-op rather than saving
                        // whatever was left half-typed.
                        setSizeDraft(task.minutes !== undefined ? String(task.minutes) : '')
                        setSizeEditingId(null)
                      }
                    }}
                  />
                ) : (
                  <button
                    className={task.minutes !== undefined ? 'task-size' : 'task-size task-size-empty'}
                    aria-label={
                      task.minutes !== undefined
                        ? `Change size for ${task.title}, currently ${formatDuration(task.minutes)}`
                        : `Set size for ${task.title}`
                    }
                    onClick={() => startSizeEdit(task)}
                  >
                    {task.minutes !== undefined ? formatDuration(task.minutes) : 'size'}
                  </button>
                )}
                {/* A float, not yet done, still eligible to move. Which one
                    to push is the owner's call, not something the capacity
                    line pre-selects - see the comment above it. */}
                {!task.time && !task.done && pushCount < MAX_PUSHES && (
                  <button
                    className="task-push"
                    aria-label={`Push ${task.title} to tomorrow`}
                    onClick={() => actions.pushTask(date, task.id)}
                  >
                    push
                  </button>
                )}
                {/* The undo for tapping a gap - see docs/TIMELINE.md
                    section 5. Placing is easy to do by accident on a
                    phone, so this sits on the task's own row rather than
                    behind a setting or a fading toast: whatever anchored a
                    task, this always turns it back into a float. Not
                    gated on how the task got its time - a hand-typed
                    anchor from quick-add un-anchors exactly the same way a
                    gap-placed one does, since both are just a task with a
                    time either way. */}
                {task.time && !task.done && (
                  <button
                    className="task-unanchor"
                    aria-label={`Remove time from ${task.title}`}
                    onClick={() => actions.unanchorTask(date, task.id)}
                  >
                    remove time
                  </button>
                )}
                <button
                  className="task-delete"
                  aria-label={atBound ? `Let go of ${task.title}` : `Delete ${task.title}`}
                  onClick={() => actions.deleteTask(date, task.id)}
                >
                  &times;
                </button>
              </div>
              {atBound && (
                <p id={noteId} className="task-maxed-note">
                  {`Pushed ${pushCountLabel(pushCount)} - do it today, or let it go. Deleting counts as a decision, not a failure.`}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {pushableCount > 0 && (
        <button className="rollover" onClick={() => actions.rolloverUnfinished(date)}>
          {heldCount > 0
            ? `Move ${pushableCount} to tomorrow - ${heldCount} staying here`
            : `Move ${pushableCount} unfinished to tomorrow`}
        </button>
      )}
      {pushableCount === 0 && heldCount > 0 && (
        <p className="rollover-note">Nothing left to push - the rest are waiting on a decision.</p>
      )}
    </section>
  )
}
