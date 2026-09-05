import { useAppData } from '../../lib/store'
import { formatDayTitle, todayKey } from '../../lib/dates'
import { sortTasks } from '../../widgets/day-plan/sort'
import type { Task } from '../../lib/types'

export interface WeekAgendaProps {
  /** The days the week view is showing - seven wide, three on a phone. */
  dates: string[]
  onOpenDay: (date: string) => void
  onOpenTask: (date: string, taskId: string) => void
}

/**
 * The same week, read rather than looked at.
 *
 * The grid answers a question about shape - three heavy days and a hollow
 * Thursday - and it answers it better than any list could. It is also the
 * wrong tool for the other question somebody asks of a week, which is simply
 * *what is on it*: a block 40px tall with "Call the bank about the mortgage"
 * in it says "Call the b…", and seven columns of that is a week you have to
 * decode rather than read.
 *
 * So there are two readings and one toggle between them. The grid is still
 * the default, because the shape is the thing the week view was built for and
 * a list is what every other screen in this app already is.
 *
 * What this is careful about:
 *
 * - **Days with nothing on them are still days.** They keep their heading and
 *   say so in one quiet line. Skipping them would make the list shorter and
 *   the week unreadable - an empty Thursday is information.
 * - **Today is marked once**, by weight on its heading, and nothing else on
 *   the list is. A list where four things are emphasised has emphasised
 *   nothing.
 * - **No counts and no ratios.** The grid's footers already carry those where
 *   they belong, on a day that has happened. A list of what is coming has
 *   nothing to total.
 */
export function WeekAgenda({ dates, onOpenDay, onOpenTask }: WeekAgendaProps) {
  const data = useAppData()
  const today = todayKey()

  return (
    <div className="week-agenda">
      {dates.map(date => {
        const tasks = sortTasks(data.days[date]?.tasks ?? [])
        return (
          <section key={date} className={date === today ? 'agenda-day is-today' : 'agenda-day'}>
            <h3 className="agenda-date">
              <button type="button" className="agenda-date-button" onClick={() => onOpenDay(date)}>
                {formatDayTitle(date)}
              </button>
            </h3>
            {tasks.length === 0 ? (
              <p className="agenda-empty">Nothing on this day.</p>
            ) : (
              <ul className="agenda-list">
                {tasks.map(task => (
                  <AgendaRow key={task.id} task={task} onOpen={() => onOpenTask(date, task.id)} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function AgendaRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const classes = ['agenda-row', task.done ? 'is-done' : '', task.highlight ? 'is-key' : ''].filter(Boolean).join(' ')
  return (
    <li>
      <button type="button" className={classes} onClick={onOpen}>
        <span className="agenda-time">{task.time ?? ''}</span>
        <span className="agenda-title">{task.title}</span>
      </button>
    </li>
  )
}
