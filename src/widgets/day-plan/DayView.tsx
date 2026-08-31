import { useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { addDays, formatDayTitle, todayKey } from '../../lib/dates'
import { parseQuickAdd } from './parse'
import { sortTasks } from './sort'

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
  const unfinished = tasks.filter(t => !t.done).length
  const isToday = date === todayKey()

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
        {tasks.map(task => (
          <li key={task.id} className={task.done ? 'task done' : 'task'}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                aria-label={task.title}
                onChange={() => actions.toggleTask(date, task.id)}
              />
              <span className="check" aria-hidden="true" />
              {task.time && <span className="task-time">{task.time}</span>}
              <span className="task-title">{task.title}</span>
            </label>
            <button
              className="task-delete"
              aria-label={`Delete ${task.title}`}
              onClick={() => actions.deleteTask(date, task.id)}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>

      {unfinished > 0 && (
        <button className="rollover" onClick={() => actions.rolloverUnfinished(date)}>
          Move {unfinished} unfinished to tomorrow
        </button>
      )}
    </section>
  )
}
