import { useAppData } from '../lib/store'
import { formatDayTitle } from '../lib/dates'
import { dayStat } from '../lib/dayStats'
import { resolveTemplate } from '../lib/calendarCell'
import { sortTasks } from '../widgets/day-plan/sort'

export interface DayPreviewProps {
  date: string
  onOpenDay: () => void
  /** Offered only where stamping is what the pointer is already doing. */
  onStamp?: () => void
}

/**
 * The whole of a day, without leaving the month.
 *
 * A month cell can hold three lines. A day has ten. The gap between those two
 * numbers is the reason the calendar read as unclear: everything past the
 * third line was reachable only by opening the day, which means leaving the
 * month, which means losing the thing you came to the month for - the shape
 * of the week around it.
 *
 * So resting on a cell says the rest, in place. Not a summary of the day: the
 * day, in its own order, with its times, with what is done marked as done and
 * what is key marked as key. The two numbers at the foot are the two facts a
 * past day has that the list does not already show - how much of it happened,
 * and how much of it moved.
 *
 * ## What it is careful about
 *
 * - **No count of what was missed.** "6 of 9" is a fact about a list. "3
 *   missed" is a verdict, and this app does not hand those out - the same
 *   rule the evening close and the day stats already keep.
 * - **Two actions and no more.** Open the day, and stamp it while a template
 *   is in hand. A preview that grows a third action is a menu, and a menu
 *   that appears because a cursor stopped moving is a menu nobody asked for.
 * - **A pointer thing only.** A finger taps the cell and gets the day itself,
 *   which is the better answer on a phone anyway: the day view is the whole
 *   screen and the preview would be most of one.
 */
export function DayPreview({ date, onOpenDay, onStamp }: DayPreviewProps) {
  const data = useAppData()
  const day = data.days[date]
  const tasks = sortTasks(day?.tasks ?? [])
  const template = resolveTemplate(day?.templateId, data.templates)
  const stat = dayStat(day)

  return (
    <div className="day-preview" role="tooltip">
      <div className="day-preview-head">
        <span className="day-preview-date">{formatDayTitle(date)}</span>
        {template && <span className="day-preview-template">{template.name}</span>}
      </div>

      {tasks.length === 0 ? (
        <p className="day-preview-empty">Nothing on this day yet.</p>
      ) : (
        <ul className="day-preview-list">
          {tasks.map(t => (
            <li key={t.id} className={[t.done ? 'is-done' : '', t.highlight ? 'is-key' : ''].filter(Boolean).join(' ')}>
              <span className="day-preview-time">{t.time ?? ''}</span>
              <span className="day-preview-title">{t.title}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Two facts, and neither is a verdict: how much of the list happened,
          and how much of it moved to another day. No third line counting what
          did not - see the doc comment above. */}
      {stat.rate !== null && (
        <p className="day-preview-stats">
          <span>
            {stat.done} of {stat.total} done
          </span>
          {stat.pushed > 0 && <span>{stat.pushed} moved on</span>}
        </p>
      )}

      <div className="day-preview-actions">
        <button type="button" className="btn-secondary" onClick={onOpenDay}>
          Open day
        </button>
        {onStamp && (
          <button type="button" className="btn-secondary" onClick={onStamp}>
            Stamp
          </button>
        )}
      </div>
    </div>
  )
}
