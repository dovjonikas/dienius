import type { Task } from '../../lib/types'
import { formatDuration } from './capacity'
import { computeTimelineLayout, formatAnchorTimeRange, formatClock, hourMarks, windowPercent } from './timelineLayout'

/**
 * Pixels per minute of window time. A display-density choice, not layout
 * maths - `windowPercent` in `timelineLayout.ts` owns the actual conversion
 * from a clock time to a position; this constant only decides how tall
 * one percentage point of the window ends up on screen. Chosen so a
 * typical few-hour gap still reads as air rather than collapsing to a
 * sliver, without a full waking-length day growing taller than a phone
 * screen can reasonably scroll.
 */
const PX_PER_MINUTE = 1.15

const MIN_ANCHOR_HEIGHT = 44

/**
 * The shortest a sized anchor's own card is ever drawn, regardless of how
 * short the task really is. A five-minute task drawn at its true
 * proportional height would be a handful of pixels - not wrong, exactly,
 * but too small to read at all. This is a pixel floor on the rendering,
 * the same category of choice as `MIN_ANCHOR_HEIGHT` for an unsized
 * anchor - never a change to `task.minutes` itself, which stays whatever
 * it really is and is still what the card's own label states in full once
 * there is room to show it.
 */
const SIZED_MIN_HEIGHT_PX = 24

/**
 * Below this drawn height, a card drops its time-range line and shows only
 * the title. A short anchor (a 20-minute call, say) still gets an honest,
 * proportionally small block - it just cannot fit two lines of readable
 * text inside that block without either the text spilling past the card's
 * own edge or the box growing past what its real duration earned. The
 * title is kept because it is what a person actually scans for; the exact
 * range is one glance away in the task list below, or a wider window away
 * in the block's own aria-hidden neighbours.
 */
const COMPACT_HEIGHT_PX = 40

/**
 * Width of the hour-label column on the left of the grid. Anchors and
 * gaps are positioned in the remaining space via `calc()`, so the same
 * single coordinate system (percent of the window's total minutes, from
 * `windowPercent`) still drives both the vertical position and the
 * horizontal gutter, with no second layout pass. Kept in sync by hand
 * with the matching pixel value in styles.css.
 */
const GUTTER_PX = 44

export interface TimelineGridProps {
  tasks: Task[]
  /**
   * The day's own template color, if it has one - see `docs/TIMELINE.md`
   * section 5: anchors show "the day-type colour they came from." A task
   * only ever has one color source today, the template a day was stamped
   * from, so every anchor on a given day shares the same one. A day with
   * no template (nothing stamped, or a hand-typed anchor on an otherwise
   * blank day) falls back to a neutral card instead of inventing a color
   * that was never chosen.
   */
  templateColor?: string
}

/**
 * Zone 2 of the day view: a read-only vertical hour grid. Anchors and the
 * gaps between them, cropped to the window `computeTimelineLayout`
 * derives from the day's own anchors - see that module's own comment for
 * how this window relates to (and deliberately disagrees with, at the
 * edges) `computeCapacity`'s fixed waking window.
 *
 * Entirely `aria-hidden`. Every anchor this grid draws is also a normal
 * row in the task list below, already reachable by a screen reader with
 * its title, time, checkbox and controls intact - that list is the
 * accessible source of truth for what is anchored when. This grid adds a
 * second, purely visual reading of the same information: a picture of the
 * day's shape, not a second, worse copy of an interactive list. Following
 * the reasoning `YearStrip.tsx` already documents for the same trade -
 * asserting no role at all reads better than asserting one only half true
 * - drawing this as a real interactive structure a second time would
 * flood the page with redundant stops for no benefit, the exact hazard a
 * timeline of blocks and free-form gap labels risks by nature. When gap
 * interaction is added in step 5, the gap elements that become genuinely
 * interactive should be pulled out from under this `aria-hidden` wrapper
 * and given their own accessible name at that point, rather than the
 * whole grid staying hidden by default.
 */
export function TimelineGrid({ tasks, templateColor }: TimelineGridProps) {
  const layout = computeTimelineLayout(tasks)
  if (!layout.window) return null

  const { window, anchors, gaps, unsizedAnchorCount } = layout
  const totalMinutes = window.end - window.start
  const heightPx = Math.round(totalMinutes * PX_PER_MINUTE)
  const marks = hourMarks(window)

  return (
    <div className="timeline-grid-wrap">
      <div className="timeline-grid-scroll">
        <div className="timeline-grid" aria-hidden="true" style={{ height: `${heightPx}px` }}>
          {marks.map(mark => (
            <div key={mark} className="timeline-hour" style={{ top: `${windowPercent(window, mark)}%` }}>
              <span className="timeline-hour-label">{formatClock(mark)}</span>
              <span className="timeline-hour-rule" />
            </div>
          ))}

          {gaps.map(gap => (
            <div
              key={`gap-${gap.startMinutes}`}
              className="timeline-gap"
              data-gap-start={gap.startMinutes}
              data-gap-end={gap.endMinutes}
              style={{
                top: `${windowPercent(window, gap.startMinutes)}%`,
                height: `${windowPercent(window, gap.endMinutes) - windowPercent(window, gap.startMinutes)}%`,
                left: `${GUTTER_PX}px`,
                width: `calc(100% - ${GUTTER_PX}px)`,
              }}
            >
              <span className="timeline-gap-label">{formatDuration(gap.minutes)} free</span>
            </div>
          ))}

          {anchors.map(anchor => {
            const top = windowPercent(window, anchor.startMinutes)
            const bottom = anchor.sized ? windowPercent(window, anchor.endMinutes!) : undefined
            const heightPercent = bottom !== undefined ? bottom - top : undefined
            const minHeightPx = anchor.sized ? SIZED_MIN_HEIGHT_PX : MIN_ANCHOR_HEIGHT
            const rawHeightPx = heightPercent !== undefined ? (heightPercent / 100) * heightPx : MIN_ANCHOR_HEIGHT
            const blockHeightPx = Math.max(rawHeightPx, minHeightPx)
            const compact = blockHeightPx < COMPACT_HEIGHT_PX
            const fraction = 1 / anchor.columns
            const classNames = ['timeline-anchor']
            if (!anchor.sized) classNames.push('timeline-anchor-unsized')
            if (anchor.clippedEnd) classNames.push('timeline-anchor-clipped')
            if (anchor.sized && templateColor) classNames.push('timeline-anchor-colored')
            return (
              <div
                key={anchor.id}
                className={classNames.join(' ')}
                style={{
                  top: `${top}%`,
                  height: heightPercent !== undefined ? `${heightPercent}%` : undefined,
                  minHeight: `${minHeightPx}px`,
                  left: `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${anchor.column * fraction})`,
                  width: `calc((100% - ${GUTTER_PX}px) * ${fraction} - 4px)`,
                  background: anchor.sized ? templateColor : undefined,
                }}
              >
                <span className="timeline-anchor-title">{anchor.title}</span>
                {!compact && (
                  <span className="timeline-anchor-time">
                    {anchor.sized
                      ? formatAnchorTimeRange(anchor.startMinutes, anchor.minutes!)
                      : `${anchor.time} - size unknown`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {unsizedAnchorCount > 0 && (
        <p className="timeline-note">Gaps aren't shown - not every anchor above has a size yet.</p>
      )}
    </div>
  )
}
