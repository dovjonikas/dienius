import { useState } from 'react'
import { actions, MAX_PUSHES, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { parseQuickAdd } from './parse'
import { sortTasks } from './sort'
import { dayScore, formatDayScore } from './score'

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
  const [input, setInput] = useState('')
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = day?.templateId
    ? data.templates.find(t => t.id === day.templateId)
    : undefined
  const unfinishedTasks = tasks.filter(t => !t.done)
  const pushableCount = unfinishedTasks.filter(t => (t.pushCount ?? 0) < MAX_PUSHES).length
  const heldCount = unfinishedTasks.length - pushableCount
  const isToday = date === todayKey()
  const score = dayScore(day?.tasks ?? [])
  const formattedScore = formatDayScore(score)
  const scoreLabel = score.planned ? `${score.done} of ${score.total} done` : undefined

  function handleAdd() {
    const parsed = parseQuickAdd(input)
    if (!parsed) return
    actions.addTask(date, parsed.title, parsed.time)
    setInput('')
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
            <span className="day-score" aria-label={scoreLabel}>
              {formattedScore}
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

      <input
        className="quick-add"
        placeholder="Add a task... try 14:00 Call mom"
        value={input}
        onChange={e => setInput(e.target.value)}
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
          const describedBy = atBound ? noteId : pushCount > 0 ? badgeId : undefined
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
                  {pushCount > 0 && !atBound && (
                    <span id={badgeId} className="task-pushed">pushed {pushCountLabel(pushCount)}</span>
                  )}
                </label>
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
