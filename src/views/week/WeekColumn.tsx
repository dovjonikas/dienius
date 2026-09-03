import { useState } from 'react'
import type { Template } from '../../lib/types'
import type { DayStat } from '../../lib/dayStats'
import type { Interval } from '../../widgets/day-plan/capacity'
import { formatDuration } from '../../widgets/day-plan/capacity'
import { categoryColor } from '../../lib/categories'
import { shortWeekday } from '../../lib/dates'
import type { DayEvent } from '../../lib/calendars'
import type { WeekBlock, WeekDayLayout } from './weekLayout'

/**
 * One day of the week, as a column.
 *
 * Everything about it is compressed on purpose. No times on the blocks - the
 * axis on the left says when, and a time printed on a 14px block is two
 * illegible numbers competing with the only word that matters. No checkboxes -
 * a week is for arranging, and ticking things off is what the day view is for,
 * one tap away through any block.
 */

export interface WeekColumnProps {
  day: WeekDayLayout
  /**
   * Which grid column this day occupies, counting the hour axis as the first.
   *
   * Stated rather than left to auto-placement. The column is `display:
   * contents`, so its head, track and foot are placed into the grid
   * individually; auto-placement puts the first of them in whatever cell is
   * free, which is the axis's own column, and the whole week silently shifts
   * one day to the right. Custom properties inherit through a contents box,
   * which is what lets one value on the parent position all three.
   */
  index: number
  isToday: boolean
  isPast: boolean
  nowMinutes: number
  window: Interval
  templates: Template[]
  template: Template | undefined
  stat: DayStat | undefined
  /** Somebody else's calendar, drawn under the day's own blocks. */
  events: DayEvent[]
  draggingId: string | null
  /** What the weekday plan would stamp here, for the header's one-tap offer. */
  weekdayTemplateId: string | undefined
  onBlockPointerDown: (block: WeekBlock, e: React.PointerEvent) => void
  onEmptyClick: (percent: number) => void
  onStamp: (templateId: string) => void
  onOpenDay: () => void
}

export function WeekColumn({
  day,
  index,
  isToday,
  isPast,
  nowMinutes,
  window,
  templates,
  template,
  stat,
  events,
  draggingId,
  weekdayTemplateId,
  onBlockPointerDown,
  onEmptyClick,
  onStamp,
  onOpenDay,
}: WeekColumnProps) {
  const [stampOpen, setStampOpen] = useState(false)
  const span = window.end - window.start
  const nowPercent = ((nowMinutes - window.start) / span) * 100
  const showNow = isToday && nowPercent >= 0 && nowPercent <= 100

  const classes = [
    'week-col',
    isToday ? 'is-today' : '',
    isPast ? 'is-past' : '',
  ].filter(Boolean).join(' ')

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only a click on the track itself, never one that bubbled up from a block.
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    onEmptyClick(((e.clientY - rect.top) / rect.height) * 100)
  }

  // "Deep work" is the `core` category - see categories.ts. The footer counts
  // it because how many hours of real work a week actually holds is the thing
  // a week of squares is least able to say for itself.
  const focusMinutes = day.blocks.reduce(
    (sum, b) => sum + (b.task.category === 'core' ? b.endMinutes - b.startMinutes : 0),
    0,
  )

  return (
    <div className={classes} data-week-date={day.date} style={{ ['--week-col' as string]: index + 2 } as React.CSSProperties}>
      <div className="week-col-head">
        <button
          type="button"
          className="week-col-day"
          aria-label={`Open ${shortWeekday(day.date)} ${Number(day.date.slice(8))}`}
          onClick={onOpenDay}
        >
          <span className="week-col-weekday">{shortWeekday(day.date)}</span>
          <span className="week-col-date">{Number(day.date.slice(8))}</span>
        </button>

        {/* The template, or the offer of one. A chip that is already there is
            a label; the same chip when the weekday plan names a template and
            the day has none is a one-tap way to apply it, which is the case
            that happens every Sunday evening. */}
        {template ? (
          <button
            type="button"
            className="week-col-template"
            style={{ ['--chip' as string]: template.color } as React.CSSProperties}
            aria-label={`${template.name} on ${shortWeekday(day.date)}. Choose a different template`}
            onClick={() => setStampOpen(o => !o)}
          >
            <span className="template-chip-dot" aria-hidden="true" />
            <span className="week-col-template-name">{template.name}</span>
          </button>
        ) : weekdayTemplateId ? (
          <button
            type="button"
            className="week-col-template is-offer"
            aria-label={`Stamp ${templates.find(t => t.id === weekdayTemplateId)?.name ?? 'template'} onto ${shortWeekday(day.date)}`}
            onClick={() => onStamp(weekdayTemplateId)}
          >
            <span aria-hidden="true">+</span>
            <span className="week-col-template-name">
              {templates.find(t => t.id === weekdayTemplateId)?.name ?? 'Stamp'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="week-col-template is-empty"
            aria-label={`Stamp a template onto ${shortWeekday(day.date)}`}
            onClick={() => setStampOpen(o => !o)}
            disabled={templates.length === 0}
          >
            +
          </button>
        )}

        {stampOpen && templates.length > 0 && (
          <div className="week-stamp-menu" role="menu">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                className="week-stamp-option"
                style={{ ['--chip' as string]: t.color } as React.CSSProperties}
                onClick={() => {
                  onStamp(t.id)
                  setStampOpen(false)
                }}
              >
                <span className="template-chip-dot" aria-hidden="true" />
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="week-track" onClick={handleTrackClick}>
        {/* The hours this day is actually awake for, where they are narrower
            than the shared axis. Shading rather than hiding: a task at 05:00
            on a late-shift day still has to be visible and still has to be
            somewhere honest. */}
        {(day.wakeTopPercent > 0.5 || day.wakeHeightPercent < 99.5) && (
          <div
            className="week-waking"
            aria-hidden="true"
            style={{ top: `${day.wakeTopPercent}%`, height: `${day.wakeHeightPercent}%` }}
          />
        )}

        {/* Under the day's own blocks on purpose: this is the shape of the day
            you plan around, not part of the plan. Nothing here is a button -
            there is nothing to tick, drag or push. */}
        {events
          .filter(e => !e.allDay && e.startMinutes !== undefined)
          .map(event => {
            const top = ((event.startMinutes! - window.start) / span) * 100
            const height = (((event.minutes ?? 30)) / span) * 100
            return (
              <div
                key={event.uid}
                className="week-external"
                aria-hidden="true"
                title={`${event.summary} - ${event.calendarName}`}
                style={{ top: `${top}%`, height: `${height}%`, ['--cal' as string]: event.color } as React.CSSProperties}
              >
                <span className="week-external-title">{event.summary}</span>
              </div>
            )
          })}

        {showNow && <div className="week-now" aria-hidden="true" style={{ top: `${nowPercent}%` }} />}

        {day.blocks.map(block => {
          const width = 100 / block.lanes
          const color = categoryColor(block.task.category) ?? template?.color
          return (
            <button
              key={block.task.id}
              type="button"
              className={[
                'week-block',
                block.task.done ? 'is-done' : '',
                draggingId === block.task.id ? 'is-dragging' : '',
                block.task.highlight ? 'is-key' : '',
              ].filter(Boolean).join(' ')}
              style={{
                top: `${block.topPercent}%`,
                height: `${block.heightPercent}%`,
                left: `${block.lane * width}%`,
                width: `${width}%`,
                ['--block' as string]: color,
              } as React.CSSProperties}
              aria-label={`${block.task.title}, ${block.task.time} on ${shortWeekday(day.date)}`}
              onPointerDown={e => onBlockPointerDown(block, e)}
            >
              <span className="week-block-title">{block.task.title}</span>
            </button>
          )
        })}
      </div>

      <div className="week-col-foot">
        {stat && stat.rate !== null ? (
          <span className="week-foot-ratio">{stat.done}/{stat.total}</span>
        ) : day.blocks.length + day.untimed.length > 0 ? (
          <span className="week-foot-count">{day.blocks.length + day.untimed.length}</span>
        ) : (
          <span className="week-foot-empty" aria-hidden="true">-</span>
        )}
        {focusMinutes > 0 && <span className="week-foot-focus">{formatDuration(focusMinutes)}</span>}
        {day.untimed.length > 0 && (
          <span className="week-foot-untimed" title={`${day.untimed.length} with no time yet`}>
            ~{day.untimed.length}
          </span>
        )}
      </div>
    </div>
  )
}
