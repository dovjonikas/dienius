import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { formatDuration } from './capacity'
import { GapPicker } from './GapPicker'
import { offerForGap } from './gapPlacement'
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
 * The shortest a gap's own tap target is ever drawn, regardless of how
 * short the free stretch really is - the same floor `MIN_ANCHOR_HEIGHT`
 * applies to an unsized anchor, applied here so a 10-minute gap between two
 * back-to-back anchors is still a real, comfortably tappable 44px target
 * rather than a sliver a thumb cannot land on. Purely a hit-area floor: it
 * never changes `gap.minutes` or anything the picker inside it offers.
 */
const GAP_MIN_HEIGHT_PX = 44

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
  /**
   * Applied to the grid's own outer wrapper so the disclosure toggle that
   * shows or hides it (see DayView.tsx) can point `aria-controls` at
   * something real once the grid actually mounts. Optional so a caller
   * with no need for one - a test, a future read-only embed - is not
   * forced to invent an id it will never use.
   */
  id?: string
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
  /**
   * Called when the owner taps a float inside an open gap's picker, with
   * the float's own task id and the clock time it should be placed at -
   * see `computeTimelineLayout`'s gaps and docs/TIMELINE.md section 5.
   * Optional so a caller with nothing to do about it (a read-only preview,
   * a test) can render the grid without wiring one up; step 5's own
   * behaviour lives entirely in this callback and the store action it
   * calls, never inside this component.
   */
  onPlaceFloat?: (taskId: string, time: string) => void
  /**
   * Called on `pointerdown` for a not-done anchor's own visual block - the
   * drag source for step 7's "drag an anchor back to the tray," wired by
   * `DayView.tsx`. Optional so a caller with nothing to do about it (a
   * read-only preview, most of this component's own tests) renders the
   * grid exactly as before this prop existed. Omitting it also means no
   * anchor carries `touch-action: none`, so the grid's own scroll
   * container behaves exactly as it always did.
   */
  onAnchorPointerDown?: (taskId: string, e: React.PointerEvent<HTMLDivElement>) => void
  /**
   * The gap currently under an in-progress drag, if any - purely a visual
   * highlight so a person dragging a float can see where it will land
   * before releasing. `DayView.tsx` recomputes this on every
   * `pointermove` from the same `data-gap-start` this component already
   * renders, the same `elementFromPoint` + `closest` technique
   * `CalendarView.tsx`'s own stamp-drag uses.
   */
  dragOverGapStart?: number | null
  /** The task id currently being dragged, if any - dims its own anchor block so the drag reads as "picked up." */
  draggingTaskId?: string | null
}

/**
 * Zone 2 of the day view: a vertical hour grid. Anchors and the gaps
 * between them, cropped to the window `computeTimelineLayout` derives from
 * the day's own anchors - see that module's own comment for how this
 * window relates to (and deliberately disagrees with, at the edges)
 * `computeCapacity`'s fixed waking window.
 *
 * Mounted only while `DayView.tsx`'s own disclosure toggle has it open -
 * this component itself knows nothing about that; it only accepts the
 * `id` that toggle's `aria-controls` points at. See `docs/RESEARCH-ADHD.md`
 * section 7 for why the grid does not get to stand in front of the task
 * list by default, and `docs/TIMELINE.md` section 5 for the collapsed
 * state itself.
 *
 * The grid itself - hour marks and anchor blocks - stays `aria-hidden` and
 * unfocusable, exactly as step 4 left it: every anchor here is already an
 * ordinary, fully accessible row in the task list below, with its title,
 * time, checkbox and controls intact, and duplicating that as a second,
 * worse, non-interactive structure would only flood the page with
 * redundant stops - see `YearStrip.tsx`'s own reasoning for the same
 * trade. Gaps are different: they are the one thing on this grid with a
 * real action behind them, so they render as real, focusable buttons in
 * their own layer, deliberately pulled out from under the aria-hidden
 * decorative layer rather than nested inside it - an aria-hidden ancestor
 * hides every descendant from assistive tech regardless of what a child
 * claims about itself, so there was no way to keep them nested and still
 * reachable. The decorative layer is given `pointer-events: none` so nothing
 * about it can ever swallow a tap meant for a gap button drawn underneath
 * or beside it.
 */
export function TimelineGrid({
  id,
  tasks,
  templateColor,
  onPlaceFloat,
  onAnchorPointerDown,
  dragOverGapStart,
  draggingTaskId,
}: TimelineGridProps) {
  const layout = computeTimelineLayout(tasks)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [openGapStart, setOpenGapStart] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const pendingFocusGapStart = useRef<number | null>(null)

  // Runs after every render, but only ever acts once - closeGap below sets
  // the pending value immediately before the render that removes the
  // picker, so by the time this effect runs the DOM already reflects
  // whatever placement just happened (React 19 batches the local
  // setOpenGapStart(null) here with the store update the same click
  // triggered in the parent into one commit). The same gap's own trigger
  // button is refocused when it still exists - a partial gap that shrank
  // rather than closed entirely keeps the same start minute and so the
  // same data-gap-start, since a placed float always starts at the gap's
  // own start (see handlePlace below). When nothing with that start
  // survives (an exact-fit placement consumed the whole gap), focus falls
  // back to the grid's own wrapper rather than silently landing on <body>.
  useEffect(() => {
    if (pendingFocusGapStart.current === null) return
    const gapStart = pendingFocusGapStart.current
    pendingFocusGapStart.current = null
    const trigger = wrapRef.current?.querySelector<HTMLButtonElement>(`[data-gap-start="${gapStart}"]`)
    if (trigger) trigger.focus()
    else wrapRef.current?.focus()
  })

  if (!layout.window) return null

  const { window, anchors, gaps, unsizedAnchorCount } = layout
  const totalMinutes = window.end - window.start
  const heightPx = Math.round(totalMinutes * PX_PER_MINUTE)
  const marks = hourMarks(window)
  const openGap = gaps.find(g => g.startMinutes === openGapStart)

  function closeGap(gapStart: number) {
    pendingFocusGapStart.current = gapStart
    setOpenGapStart(null)
  }

  function handlePlace(taskId: string, gapStart: number) {
    const time = formatClock(gapStart)
    onPlaceFloat?.(taskId, time)
    const task = tasks.find(t => t.id === taskId)
    setAnnouncement(task ? `${task.title} placed at ${time}.` : 'Placed.')
    closeGap(gapStart)
  }

  return (
    <div id={id} className="timeline-grid-wrap" ref={wrapRef} tabIndex={-1}>
      <div className="timeline-grid-scroll">
        <div className="timeline-grid-layers" style={{ height: `${heightPx}px` }}>
          <div className="timeline-grid" aria-hidden="true">
            {marks.map(mark => (
              <div key={mark} className="timeline-hour" style={{ top: `${windowPercent(window, mark)}%` }}>
                <span className="timeline-hour-label">{formatClock(mark)}</span>
                <span className="timeline-hour-rule" />
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
              const sourceTask = tasks.find(t => t.id === anchor.id)
              const draggable = !!onAnchorPointerDown && !!sourceTask && !sourceTask.done
              const classNames = ['timeline-anchor']
              if (!anchor.sized) classNames.push('timeline-anchor-unsized')
              if (anchor.clippedEnd) classNames.push('timeline-anchor-clipped')
              if (anchor.sized && templateColor) classNames.push('timeline-anchor-colored')
              if (draggable) classNames.push('timeline-anchor-draggable')
              if (draggingTaskId === anchor.id) classNames.push('timeline-anchor-dragging')
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
                  onPointerDown={draggable ? e => onAnchorPointerDown!(anchor.id, e) : undefined}
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

          <div className="timeline-gaps">
            {gaps.map(gap => {
              const top = windowPercent(window, gap.startMinutes)
              const bottom = windowPercent(window, gap.endMinutes)
              const rawHeightPx = ((bottom - top) / 100) * heightPx
              const isOpen = openGapStart === gap.startMinutes
              const isDragOver = dragOverGapStart === gap.startMinutes
              const label = `${formatDuration(gap.minutes)} free, ${formatClock(gap.startMinutes)} to ${formatClock(gap.endMinutes)}. Tap to place a float.`
              return (
                <button
                  key={`gap-${gap.startMinutes}`}
                  type="button"
                  className={isDragOver ? 'timeline-gap timeline-gap-drag-over' : 'timeline-gap'}
                  data-gap-start={gap.startMinutes}
                  data-gap-end={gap.endMinutes}
                  aria-label={label}
                  aria-haspopup="dialog"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGapStart(isOpen ? null : gap.startMinutes)}
                  style={{
                    top: `${top}%`,
                    height: `${Math.max(bottom - top, 0)}%`,
                    minHeight: `${Math.max(rawHeightPx, GAP_MIN_HEIGHT_PX)}px`,
                    left: `${GUTTER_PX}px`,
                    width: `calc(100% - ${GUTTER_PX}px)`,
                  }}
                >
                  <span className="timeline-gap-label" aria-hidden="true">{formatDuration(gap.minutes)} free</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {unsizedAnchorCount > 0 && (
        <p className="timeline-note">Gaps aren't shown - not every anchor above has a size yet.</p>
      )}

      <p className="visually-hidden" aria-live="polite">{announcement}</p>

      {openGap && (
        <GapPicker
          gapLabel={`${formatDuration(openGap.minutes)} free, ${formatClock(openGap.startMinutes)} to ${formatClock(openGap.endMinutes)}`}
          offer={offerForGap(tasks, openGap.minutes)}
          onPlace={taskId => handlePlace(taskId, openGap.startMinutes)}
          onClose={() => closeGap(openGap.startMinutes)}
        />
      )}
    </div>
  )
}
