import { categoryColor } from '../lib/categories'
import type { Category, SleepProfile, TemplateBlock, WeekDayOverride } from '../lib/types'
import { formatClock } from '../widgets/day-plan/timelineLayout'
import { blocksAsTasks } from './templateDay'
import { computeWeekLayout, type WeekBlock } from './week/weekLayout'
import { useTimeGhost } from '../lib/timeGhost'
import { ghostKeyFor } from './WeekTemplateEditor'

/**
 * A week template drawn the way the calendar draws a week.
 *
 * It used to be seven narrow lists of chips - a title, a time, a size, Key,
 * Note and a cross, in a column a seventh of the editor wide. At that width
 * every one of those wrapped onto its own line, so a block was five stacked
 * fragments and a column of four blocks was twenty. The owner's word for it
 * was that it did not look clean, and the picture was the answer: a week is
 * a shape, and this is the one place the shape could not be seen.
 *
 * **It is the calendar's own week, fed template blocks.** `computeWeekLayout`
 * takes dates and day plans and returns a shared window, the hour lines and
 * every block's top, height and lane - so seven synthetic days built from
 * `blocksAsTasks` produce exactly the geometry the calendar produces, down to
 * how two overlapping blocks split a column. The stylesheet is the same one
 * too (`.week-grid`, `.week-axis`, `.week-block`), which is why a template
 * week and a real week look alike rather than merely similar: they are drawn
 * by the same rules, not by two sets of rules kept in step by hand.
 *
 * The dates are a fiction. `computeWeekLayout` keys everything by date, so
 * this hands it one arbitrary Monday-to-Sunday week whose weekdays line up
 * with `TemplateBlock.weekday`. Nothing here reads the date back out except
 * to find which column a block belongs to.
 */

/**
 * A week whose weekdays are 1..5, 6, 0 in that order - a real Monday through
 * Sunday, chosen once so the mapping is a lookup rather than arithmetic.
 * 2026-09-14 is a Monday.
 */
const DATES = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']
const WEEKDAY_OF: Record<string, number> = {
  '2026-09-14': 1,
  '2026-09-15': 2,
  '2026-09-16': 3,
  '2026-09-17': 4,
  '2026-09-18': 5,
  '2026-09-19': 6,
  '2026-09-20': 0,
}

const NAMES: Record<number, { label: string; short: string }> = {
  1: { label: 'Monday', short: 'Mon' },
  2: { label: 'Tuesday', short: 'Tue' },
  3: { label: 'Wednesday', short: 'Wed' },
  4: { label: 'Thursday', short: 'Thu' },
  5: { label: 'Friday', short: 'Fri' },
  6: { label: 'Saturday', short: 'Sat' },
  0: { label: 'Sunday', short: 'Sun' },
}

export interface WeekTemplateGridProps {
  blocks: TemplateBlock[]
  weekDays: Partial<Record<number, WeekDayOverride>>
  /** The template's own schedule, which a column may override. */
  sleepProfileId?: string
  sleepProfiles: SleepProfile[]
  categories: Category[]
  /** The template's colour, for a block with no category of its own. */
  color: string
  /** Every library list by id, so a bound block can say what it draws from. */
  libraryNames: Record<string, string>
  activeDay: number
  draggingId: string | null
  /** Which block's panel is open, so the grid can say which one it is. */
  openBlockId?: string | null
  onPickDay: (day: number) => void
  onOpenBlock: (block: TemplateBlock) => void
  onBlockPointerDown: (block: TemplateBlock, e: React.PointerEvent) => void
  /** A press on empty track, with the time it landed on. */
  onEmptyPress: (day: number, time: string) => void
  /** What each column says under it - its day type, and the press to change it. */
  foot: (day: number) => React.ReactNode
}

export function WeekTemplateGrid({
  blocks,
  weekDays,
  sleepProfileId,
  sleepProfiles,
  categories,
  color,
  libraryNames,
  activeDay,
  draggingId,
  openBlockId,
  onPickDay,
  onOpenBlock,
  onBlockPointerDown,
  onEmptyPress,
  foot,
}: WeekTemplateGridProps) {
  const days = Object.fromEntries(
    DATES.map(date => {
      const weekday = WEEKDAY_OF[date]
      return [
        date,
        {
          date,
          tasks: blocksAsTasks(blocks, weekday),
          sleepProfileId: weekDays[weekday]?.sleepProfileId ?? sleepProfileId,
        },
      ]
    }),
  )
  const layout = computeWeekLayout(DATES, days, { profiles: sleepProfiles })
  const span = layout.window.end - layout.window.start

  // What is being chosen, drawn on the column it would land on. It used to be
  // drawn on a full-width picture of the active day above this grid, which
  // said the same thing as one of these seven columns and took three hundred
  // pixels to say it.
  const ghost = useTimeGhost(ghostKeyFor(activeDay))
  const ghostTop = ghost ? ((ghost.start - layout.window.start) / span) * 100 : 0
  const ghostHeight = ghost ? ((ghost.minutes ?? 0) / span) * 100 : 0

  /** The block behind a laid-out one. Blocks carry their own ids through `blocksAsTasks`. */
  const blockFor = (placed: WeekBlock) => blocks.find(b => b.id === placed.task.id)

  return (
    <div className="week-grid wt-grid">
      <div className="week-axis" aria-hidden="true">
        {layout.hours.map(minutes => (
          <span key={minutes} className="week-hour" style={{ top: `${((minutes - layout.window.start) / span) * 100}%` }}>
            {formatClock(minutes)}
          </span>
        ))}
      </div>

      {layout.days.map((day, i) => {
        const weekday = WEEKDAY_OF[day.date]
        const name = NAMES[weekday]
        return (
          <div
            key={day.date}
            className={weekday === activeDay ? 'week-col wt-col is-active' : 'week-col wt-col'}
            // Named, so a drop can find it and so the column is a place
            // rather than a slice - the same landmark the chip lists had.
            role="region"
            aria-label={name.label}
            data-wt-day={weekday}
            style={{ ['--week-col' as string]: i + 2 } as React.CSSProperties}
          >
            <div className="week-col-head">
              <button
                type="button"
                className="week-col-day"
                aria-pressed={weekday === activeDay}
                aria-label={`${name.label}. ${day.blocks.length + day.untimed.length} blocks`}
                onClick={() => onPickDay(weekday)}
              >
                <span className="week-col-weekday">{name.short}</span>
              </button>
            </div>

            {/* The track. A press on empty space is the fastest way to put a
                block at a time, the same gesture the day's own grid takes. */}
            <div
              className="week-track"
              onClick={e => {
                if (e.target !== e.currentTarget) return
                const rect = e.currentTarget.getBoundingClientRect()
                const percent = ((e.clientY - rect.top) / rect.height) * 100
                const minutes = Math.round((layout.window.start + (percent / 100) * span) / 15) * 15
                const clamped = Math.max(layout.window.start, Math.min(layout.window.end - 15, minutes))
                onEmptyPress(weekday, formatClock(clamped))
              }}
            >
              {day.blocks.map(placed => {
                const width = 100 / placed.lanes
                const block = blockFor(placed)
                return (
                  <button
                    key={placed.task.id}
                    type="button"
                    className={[
                      'week-block',
                      draggingId === placed.task.id ? 'is-dragging' : '',
                      placed.task.highlight ? 'is-key' : '',
                      openBlockId === placed.task.id ? 'is-open' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      top: `${placed.topPercent}%`,
                      height: `${placed.heightPercent}%`,
                      left: `${placed.lane * width}%`,
                      width: `${width}%`,
                      ['--block' as string]: categoryColor(placed.task.category, categories) ?? color,
                    } as React.CSSProperties}
                    aria-label={`${placed.task.title} at ${placed.task.time} on ${name.label}. Open it, or drag it to another day.`}
                    onPointerDown={e => block && onBlockPointerDown(block, e)}
                    onClick={() => block && onOpenBlock(block)}
                  >
                    <span className="week-block-title">{placed.task.title}</span>
                    {/* What it draws from, which the chip it replaced said
                        and which is the whole point of a bound block. */}
                    {block?.libraryListId && (
                      <span className="week-block-from">from {libraryNames[block.libraryListId] ?? 'a list'}</span>
                    )}
                    <span className="week-block-time">
                      {formatClock(placed.startMinutes)} - {formatClock(placed.endMinutes)}
                    </span>
                  </button>
                )
              })}
              {ghost && weekday === activeDay && (
                <div
                  className={ghost.minutes ? 'wt-ghost' : 'wt-ghost is-line'}
                  aria-hidden="true"
                  style={{
                    top: `${ghostTop}%`,
                    height: ghost.minutes ? `${ghostHeight}%` : undefined,
                    ['--block' as string]: ghost.color,
                  } as React.CSSProperties}
                />
              )}

              {day.blocks.length === 0 && day.untimed.length === 0 && (
                <span className="wt-col-empty">Nothing yet</span>
              )}
            </div>

            <div className="week-col-foot wt-col-foot">
              {/* A block with no time is not on the picture, because there is
                  nowhere on a clock to draw it. It still has to be here: it is
                  on the day, and a block nobody can see is a block nobody can
                  remove. The chip list this grid replaced showed it by
                  accident; this shows it on purpose. */}
              {day.untimed.length > 0 && (
                <div className="wt-untimed">
                  {day.untimed.map(task => {
                    const block = blocks.find(b => b.id === task.id)
                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={openBlockId === task.id ? 'wt-untimed-block is-open' : 'wt-untimed-block'}
                        aria-label={`${task.title}, no time, on ${name.label}. Open it.`}
                        onClick={() => block && onOpenBlock(block)}
                      >
                        {task.title}
                      </button>
                    )
                  })}
                </div>
              )}
              {foot(weekday)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
