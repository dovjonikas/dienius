import { useEffect, useRef, useState } from 'react'
import type { Task } from '../../lib/types'
import { formatDuration, windowFor, type SleepSettings } from './capacity'
import { categoryColor } from '../../lib/categories'
import { GapPicker } from './GapPicker'
import { offerForGap } from './gapPlacement'
import {
  computeTimelineLayout,
  emptyDayLayout,
  computeVerticalLayout,
  currentMinutes,
  formatAnchorTimeRange,
  formatClock,
  halfHourMarks,
  hourMarks,
  fitPxPerMinute,
  legibleHourLabels,
} from './timelineLayout'
import { useAvailableGridHeight } from './useAvailableGridHeight'

/**
 * Pixels per minute of window time before any touch-target floor below is
 * applied. A display-density choice, not layout maths - `computeVerticalLayout`
 * in `timelineLayout.ts` owns the actual conversion from a clock time to a
 * pixel position, including the floors that keep a short gap or anchor from
 * ever being drawn under its neighbour; this constant only decides how tall
 * one minute of real time ends up on screen before any floor can stretch it
 * further. Chosen so a typical few-hour gap still reads as air rather than
 * collapsing to a sliver, without a full waking-length day growing taller
 * than a phone screen can reasonably scroll.
 */
const PX_PER_MINUTE = 1.15

/**
 * The densest a wide-screen grid is ever drawn at, regardless of how much
 * vertical room `useAvailableGridHeight` measures. Without a cap, one
 * anchor alone on a very tall monitor would divide a huge available height
 * by a small window and draw as an absurdly oversized block - "use the
 * height that is actually there" was never a request to stretch a
 * 30-minute call to hundreds of pixels tall. Three times the phone's own
 * density: generous enough that a genuinely sparse day visibly spreads out
 * to use real extra room, conservative enough that a block still reads as
 * a block rather than a slab. Judgment, not a measurement of any one
 * screen - see fix-fill-viewport-height-report.md.
 */
const MAX_PX_PER_MINUTE_WIDE = PX_PER_MINUTE * 3

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
 *
 * 32, not 24. At 24 the floor never actually bound: `.timeline-anchor`'s
 * own padding (6px top and bottom) plus a 13px/1.4 line-height title
 * already need close to 30px of content box before the constant is ever
 * reached, so a short anchor rendered a few pixels taller than the code
 * implied rather than the honest 24px the constant claimed. 32px was
 * checked against that same rendered box in the running app rather than
 * assumed - see docs/RESEARCH-TIMELINE-UI.md section 5 point 3, which also
 * covers `timeline-anchor-compact`'s tighter padding below, the other half
 * of reconciling this floor with what the box model actually needs.
 */
const SIZED_MIN_HEIGHT_PX = 32

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
 * rather than a sliver a thumb cannot land on. Never changes `gap.minutes`
 * or anything the picker inside it offers - but unlike the sized-anchor
 * floor above, this one is not just a rendering clamp: `computeVerticalLayout`
 * reserves this many pixels for the gap and pushes everything after it down
 * to match, which is what stops a floored gap from ever being drawn under
 * the anchor that follows it. See that function's own doc comment for why.
 */
const GAP_MIN_HEIGHT_PX = 44

/**
 * Width of the hour-label column on the left of the grid. Anchors and gaps
 * are positioned in the remaining space via `calc()`, so the same single
 * pixel coordinate system - from `computeVerticalLayout` - still drives
 * both the vertical position and the horizontal gutter, with no second
 * layout pass. Kept in sync by hand with the matching pixel value in
 * styles.css.
 */
const GUTTER_PX = 44

/**
 * How close two hour labels are allowed to get before the later one drops
 * its number - see `legibleHourLabels` in timelineLayout.ts. The label is
 * 11px type, so this is roughly two and a half lines of it: enough that two
 * adjacent times read as two separate times rather than as one smudge, on a
 * grid that has been compressed to fit a short screen.
 */
const MIN_HOUR_LABEL_GAP_PX = 28

/**
 * The shortest free stretch that gets its size written on it. Below this the
 * gap is still a real, tappable button at its full 44px target - nothing about
 * what it does changes - it just goes quiet.
 *
 * A busy day is mostly short gaps: the ten minutes between two meetings, the
 * quarter hour before a commute. Labelling every one of them fills the middle
 * of the grid with small text saying nothing anyone acts on, and buries the
 * two or three genuinely usable holes among a dozen that are not. Half an hour
 * is roughly the smallest stretch a real task fits in, which makes it the line
 * between "free time" and "the space between things".
 */
const MIN_LABELLED_GAP_MINUTES = 30

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
   * Called on `pointerdown` for the grab strip along a sized anchor's bottom
   * edge - the gesture that changes how long a task is by pulling it. Wired
   * by `DayView` to the same drag machinery the move gesture uses, so the two
   * share one Escape handler, one document-level listener pair and one undo.
   *
   * A plain div rather than a button, deliberately: everything inside
   * `.timeline-grid` is decorative and unfocusable by construction (see this
   * component's own doc comment), and a focusable control here would break
   * that. A keyboard has the size control on the task's own card, which is
   * the accessible path to the same change and always has been.
   */
  onAnchorResizePointerDown?: (taskId: string, e: React.PointerEvent<HTMLElement>) => void
  /** The task id currently being dragged, if any - dims its own anchor block so the drag reads as "picked up." */
  draggingTaskId?: string | null
  /**
   * The task happening right now, if any - see `activeTask` in capacity.ts.
   * `DayView` works it out once and hands the same id to both this grid and
   * the task list, so the block and the card can never disagree about which
   * one is current. Optional, and meaningless on a day that is not today.
   */
  activeTaskId?: string | null
  /**
   * Publishes the grid's own pixel-to-clock mapping upward, once per layout.
   *
   * `DayView` owns the drag: it has the document-level pointer listeners, the
   * Escape handling and the tray-drop detection already, and moving all of
   * that down here would mean this component knowing about a tray that lives
   * outside it. But the mapping between a pointer position and a time belongs
   * to whatever actually drew the grid - it depends on the density this
   * component measured and on the piecewise floors it laid out with - so it
   * is handed over rather than recomputed from guesses on the other side.
   * Called with null when the grid is about to stop drawing, so a stale
   * mapping can never outlive the layout it came from.
   */
  onGeometry?: (geometry: GridGeometry | null) => void
  /**
   * True when the day this grid is drawing is today's own date - see
   * DayView.tsx's own `isToday`. The current-time indicator only ever
   * makes sense against today: "now" has no honest position on a day in
   * the past or the future. Optional and defaults to false, so every
   * existing caller (a read-only preview, most of this component's own
   * tests) renders exactly as it did before this prop existed, with no
   * indicator drawn.
   */
  isToday?: boolean
  /**
   * True at the wide breakpoint - see `docs/LAYOUT-WIDE.md` section 5 and
   * `useIsWide()` in `lib/viewport.ts`, which `DayView.tsx` passes straight
   * through. Optional and defaults to false, so every existing caller (a
   * read-only preview, most of this component's own tests) draws at the
   * phone's fixed `PX_PER_MINUTE` exactly as it always has - only a caller
   * that explicitly says the viewport is wide ever measures anything or
   * draws denser than that. See `fix-fill-viewport-height-report.md` for
   * why: the phone's own viewport height rarely has genuine room to spare,
   * so it never pays for a measurement it would not act on.
   */
  isWide?: boolean
  /**
   * The day's own type, if it has one - decides which of `sleep`'s two
   * windows the grid's greyed sleep band and every position on it are
   * measured against, exactly the way `computeCapacity` already picks
   * between them for the capacity line - see `windowFor` in capacity.ts.
   * Optional and defaults to `'full'`, the same default `computeCapacity`
   * and `computeTimelineLayout` themselves use.
   */
  /** Which sleep schedule this day is measured against - see `SleepProfile`. */
  sleepProfileId?: string
  /**
   * Opens everything about the block's task - see `TaskDetail.tsx`. Reached
   * by a double click or a right click rather than a plain one, because a
   * plain press on a block already begins a drag and the two gestures would
   * fight over every attempt to move something. Optional, so every caller
   * and test written before the detail sheet existed behaves as it did.
   */
  onOpenTaskDetails?: (taskId: string) => void
  /** Opens the pointer's own quick menu for this block - see TaskContextMenu. */
  onTaskContextMenu?: (taskId: string, x: number, y: number) => void
  /**
   * The owner's sleep schedules - see `Settings.sleepProfiles` in types.ts.
   * Optional so a caller with nothing to pass (a read-only preview, most of
   * this component's own tests) still renders correctly: `windowFor` itself
   * falls back to the exact fixed 07:00-23:00 window this app always used.
   */
  sleep?: SleepSettings
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
/** The one thing a drag needs from the grid - see `onGeometry`. */
export interface GridGeometry {
  /** Clock minutes at a viewport y position, clamped to the drawn window. */
  minutesAtClientY: (clientY: number) => number
  /** Where a clock time sits, in the same viewport coordinates. */
  clientYAt: (minutes: number) => number
}

export function TimelineGrid({
  id,
  tasks,
  templateColor,
  onPlaceFloat,
  onAnchorPointerDown,
  onAnchorResizePointerDown,
  draggingTaskId,
  activeTaskId,
  onGeometry,
  isToday = false,
  isWide = false,
  sleepProfileId,
  onOpenTaskDetails,
  onTaskContextMenu,
  sleep,
}: TimelineGridProps) {
  // A day with nothing anchored still gets a grid - see emptyDayLayout.
  // The alternative is a blank column beside a full task list, with nowhere
  // to drop any of it.
  const derived = computeTimelineLayout(tasks, sleepProfileId, sleep)
  const layout = derived.displayWindow ? derived : emptyDayLayout(sleepProfileId, sleep)
  const isEmptyDay = derived.displayWindow === null
  const wrapRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<{
    vertical: ReturnType<typeof computeVerticalLayout>
    window: { start: number; end: number }
  } | null>(null)
  const geometryRef = useRef<GridGeometry>({
    minutesAtClientY(clientY) {
      const current = layoutRef.current
      const box = layersRef.current?.getBoundingClientRect()
      if (!current || !box) return 0
      const raw = current.vertical.minutesAt(clientY - box.top)
      return Math.min(current.window.end, Math.max(current.window.start, raw))
    },
    clientYAt(minutes) {
      const current = layoutRef.current
      const box = layersRef.current?.getBoundingClientRect()
      if (!current || !box) return 0
      return box.top + current.vertical.topPx(minutes)
    },
  })
  const [openGapStart, setOpenGapStart] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const pendingFocusGapStart = useRef<number | null>(null)
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())
  // Null until enabled and measured (or always null on the phone - see the
  // hook's own doc comment) - chooseWidePxPerMinute below treats a null
  // reading as "nothing available yet" (0px), which floors straight back
  // to PX_PER_MINUTE, the same density the phone always draws at.
  const availableHeightPx = useAvailableGridHeight(wrapRef, isWide)

  // Handed over once, and taken back on unmount so a mapping can never
  // outlive the grid that produced it.
  useEffect(() => {
    onGeometry?.(geometryRef.current)
    return () => onGeometry?.(null)
  }, [onGeometry])

  // Coarse on purpose - see docs/RESEARCH-TIMELINE-UI.md section 5 point 7:
  // a planner has no reason to animate every second, so this recomputes
  // once a minute rather than driving a render loop. Skipped entirely when
  // the grid is not drawing today, since nothing here would ever be shown.
  useEffect(() => {
    if (!isToday) return
    const timer = setInterval(() => setNowMinutes(currentMinutes()), 60_000)
    return () => clearInterval(timer)
  }, [isToday])

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

  if (!layout.displayWindow) return null

  // displayWindow, not window, is what everything below is actually drawn
  // against - window (the plain anchor-buffered interval, unextended) still
  // drives computeTimelineLayout's own gap arithmetic, but has no further
  // role once the layout comes back - see that function's own doc comment
  // for why the two are meant to differ at the edges here too.
  const { displayWindow: window, anchors, gaps, unsizedAnchorCount, sleepBands } = layout
  const marks = hourMarks(window)
  const halfMarks = halfHourMarks(window)
  const openGap = gaps.find(g => g.startMinutes === openGapStart)
  const waking = windowFor(sleepProfileId, sleep)

  // At the wide breakpoint, draw denser than the phone's own fixed density
  // whenever there is real, measured room to use it - see
  // chooseWidePxPerMinute's own doc comment and fix-fill-viewport-height-
  // report.md. Never below PX_PER_MINUTE (a wide screen must never draw a
  // day more cramped than the phone already does) and never above
  // MAX_PX_PER_MINUTE_WIDE. Off the wide breakpoint this is exactly
  // PX_PER_MINUTE, unconditionally - isWide defaults to false and
  // availableHeightPx is always null in that case, so nothing here can
  // change what the phone draws.
  // See computeVerticalLayout's own doc comment: these floors are what stop
  // a short gap's touch-target minimum from ever being drawn over the anchor
  // that follows it. A day with any unsized anchor draws no gap objects at
  // all (see computeTimelineLayout), so no floor is reserved for a button
  // that will never exist there.
  const floors = {
    sizedAnchorFloorPx: SIZED_MIN_HEIGHT_PX,
    unsizedAnchorFloorPx: MIN_ANCHOR_HEIGHT,
    gapFloorPx: unsizedAnchorCount > 0 ? 0 : GAP_MIN_HEIGHT_PX,
  }

  // At the wide breakpoint the day view is a fixed-height shell (see the
  // .app:has(.main-day) block in styles.css) whose whole point is that the
  // day is one screen with nothing to scroll. So the density here is
  // whatever makes this day fit the room actually measured for it - denser
  // than the phone where there is room to spare, thinner where there is
  // not, which is the half chooseWidePxPerMinute deliberately would not do.
  // Off the wide breakpoint this is exactly PX_PER_MINUTE, unconditionally:
  // isWide defaults to false and availableHeightPx is always null in that
  // case, so nothing here can change what the phone draws.
  const pxPerMinute = isWide
    ? fitPxPerMinute(window, anchors, floors, availableHeightPx ?? 0, MAX_PX_PER_MINUTE_WIDE, PX_PER_MINUTE)
    : PX_PER_MINUTE

  const vertical = computeVerticalLayout(window, anchors, { pxPerMinute, ...floors })
  const heightPx = Math.round(vertical.totalHeightPx)
  const labelledMarks = legibleHourLabels(marks, vertical.topPx, MIN_HOUR_LABEL_GAP_PX)

  // The geometry object handed upward is created once and never replaced -
  // see the onGeometry prop. What changes every render is this ref, which it
  // reads through. Assigning a ref during render is a mutation, and it is the
  // right one here: nothing subscribes to it, it is only ever read from a
  // pointer handler that runs long after this render committed, and the
  // alternative - publishing a fresh closure on every layout - would mean the
  // parent re-subscribing on every tick of the clock.
  layoutRef.current = { vertical, window }

  // Only ever true against today's own window - see the `isToday` prop's
  // own doc comment. A day whose anchors are entirely in the past or
  // entirely in the future draws no line, the same honesty rule the rest
  // of this grid already follows for an empty or unsized day.
  const showNowLine = isToday && nowMinutes >= window.start && nowMinutes <= window.end
  const nowTop = showNowLine ? vertical.topPx(nowMinutes) : null

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
        <div className="timeline-grid-layers" ref={layersRef} style={{ height: `${heightPx}px` }}>
          <div className="timeline-grid" aria-hidden="true">
            {/* The sleep window, greyed rather than cropped away - see
                docs/OPEN-QUESTIONS.md's old entry on the fixed waking window
                this setting replaced. Painted first in this layer so every
                hour mark, half-hour rule, anchor and the now-line all draw
                on top of it, exactly like a background wash rather than a
                foreground element competing with them.

                Carries its own small "Sleep" label, in the same quiet
                register as a gap's own label (.timeline-gap-label) - a
                greyed rectangle with nothing written on it reads as padding
                or a rendering glitch, not "this is when I sleep," and a
                shape alone was never going to say that on its own no matter
                how it was tuned. The label is decorative, the same as the
                band itself: this whole layer is already aria-hidden, and
                this div repeats that explicitly rather than relying only on
                the ancestor, so the choice reads as deliberate here rather
                than inherited by accident. The one thing worth saying about
                the actual boundary time is said once, in real text, by the
                visually-hidden sentence below the grid - this label names
                what the shape is, that sentence states when it is. */}
            {sleepBands.map(band => {
              const bandTop = vertical.topPx(band.start)
              const bandHeightPx = vertical.topPx(band.end) - bandTop
              return (
                <div
                  key={`sleep-${band.start}`}
                  className="timeline-sleep-band"
                  aria-hidden="true"
                  style={{ top: `${bandTop}px`, height: `${bandHeightPx}px` }}
                >
                  {/* Omitted below COMPACT_HEIGHT_PX, the same cutoff a
                      short sized anchor's own time range already uses -
                      SLEEP_BAND_MIN_MINUTES normally earns well over this,
                      but a bedtime pinned right at the edge of the
                      calendar day can clamp a band down to a sliver with
                      no room to letter, and the label should disappear
                      before it starts spilling out of its own shape. */}
                  {bandHeightPx >= COMPACT_HEIGHT_PX && <span className="timeline-sleep-band-label">Sleep</span>}
                </div>
              )
            })}

            {marks.map(mark => (
              <div key={mark} className="timeline-hour" style={{ top: `${vertical.topPx(mark)}px` }}>
                {labelledMarks.has(mark) && <span className="timeline-hour-label">{formatClock(mark)}</span>}
                <span className="timeline-hour-rule" />
              </div>
            ))}

            {halfMarks.map(mark => (
              <div
                key={`half-${mark}`}
                className="timeline-half-hour-rule"
                style={{ top: `${vertical.topPx(mark)}px` }}
              />
            ))}

            {anchors.map(anchor => {
              const top = vertical.topPx(anchor.startMinutes)
              const bottom = anchor.sized ? vertical.topPx(anchor.endMinutes!) : undefined
              const heightPx = bottom !== undefined ? bottom - top : undefined
              const minHeightPx = anchor.sized ? SIZED_MIN_HEIGHT_PX : MIN_ANCHOR_HEIGHT
              // The cluster this anchor belongs to already reserves at
              // least minHeightPx of vertical room (computeVerticalLayout),
              // so this Math.max is only ever a safety net for one member
              // of a multi-column cluster whose own span is shorter than
              // its longer column-mates - it can never push into whatever
              // comes after the cluster as a whole.
              const blockHeightPx = Math.max(heightPx ?? minHeightPx, minHeightPx)
              const compact = blockHeightPx < COMPACT_HEIGHT_PX
              const fraction = 1 / anchor.columns
              const sourceTask = tasks.find(t => t.id === anchor.id)
              // A category paints the block itself - a soft wash of its own
              // colour with the full strength kept for the left edge, applied
              // from CSS off a custom property so the wash can be mixed
              // against whichever surface the current theme provides. A task
              // with no category (one typed before categories existed, or
              // restored from an older backup) falls back to the inline
              // template colour exactly as every anchor used to, so nothing
              // already on disk is silently recoloured.
              const catColor = anchor.sized ? categoryColor(sourceTask?.category) : undefined
              const draggable = !!onAnchorPointerDown && !!sourceTask && !sourceTask.done
              const classNames = ['timeline-anchor']
              if (!anchor.sized) classNames.push('timeline-anchor-unsized')
              if (anchor.clippedEnd) classNames.push('timeline-anchor-clipped')
              if (catColor) classNames.push('timeline-anchor-cat')
              else if (anchor.sized && templateColor) classNames.push('timeline-anchor-colored')
              // Finished work reads as finished here too, not just in the
              // task list: the same muted fill and struck-through title, so
              // one look at the grid says how much of the day is behind you
              // without counting anything. Never removed from the grid - the
              // block is what makes the shape of the day legible, and a day
              // with its afternoon quietly deleted out of it is not the same
              // picture.
              if (sourceTask?.done) classNames.push('timeline-anchor-done')
              if (activeTaskId === anchor.id) classNames.push('timeline-anchor-now')
              if (compact) classNames.push('timeline-anchor-compact')
              if (draggable) classNames.push('timeline-anchor-draggable')
              if (draggingTaskId === anchor.id) classNames.push('timeline-anchor-dragging')
              return (
                <div
                  key={anchor.id}
                  className={classNames.join(' ')}
                  style={{
                    top: `${top}px`,
                    height: heightPx !== undefined ? `${heightPx}px` : undefined,
                    minHeight: `${minHeightPx}px`,
                    left: `calc(${GUTTER_PX}px + (100% - ${GUTTER_PX}px) * ${anchor.column * fraction})`,
                    width: `calc((100% - ${GUTTER_PX}px) * ${fraction} - 4px)`,
                    background: catColor ? undefined : anchor.sized ? templateColor : undefined,
                    ...(catColor ? { ['--cat' as string]: catColor } : {}),
                  } as React.CSSProperties}
                  onPointerDown={draggable ? e => onAnchorPointerDown!(anchor.id, e) : undefined}
                  onDoubleClick={onOpenTaskDetails ? () => onOpenTaskDetails(anchor.id) : undefined}
                  onContextMenu={
                    onTaskContextMenu
                      ? e => {
                          e.preventDefault()
                          onTaskContextMenu(anchor.id, e.clientX, e.clientY)
                        }
                      : undefined
                  }
                >
                  <span className="timeline-anchor-title">{anchor.title}</span>
                  {/* The grab strip, on a sized anchor only: an unsized one is
                      not drawn at its real length, so pulling its edge would
                      be editing a number that is not on screen. */}
                  {draggable && anchor.sized && onAnchorResizePointerDown && (
                    <span
                      className="timeline-anchor-resize"
                      onPointerDown={e => onAnchorResizePointerDown(anchor.id, e)}
                    />
                  )}
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

            {/* Painted last within this layer so the line reads across an
                anchor's own colored fill too, matching how every calendar
                examined for docs/RESEARCH-TIMELINE-UI.md draws it - "now"
                stays visible even when it falls inside an occupied block,
                rather than disappearing under one. */}
            {showNowLine && (
              <>
                <div className="timeline-now-line" style={{ top: `${nowTop}px` }} />
                <div className="timeline-now-dot" style={{ top: `${nowTop}px` }} />
                {/* The clock time, printed in the gutter on the line itself.
                    Without it the line says "somewhere around here" and the
                    reader has to interpolate between two hour marks that a
                    compressed day may have drawn unevenly - see
                    computeVerticalLayout. It sits in the same decorative,
                    aria-hidden layer as the line: this is the same number the
                    header already states in real text, said again in the one
                    place the eye is already looking. */}
                <div className="timeline-now-label" style={{ top: `${nowTop}px` }}>
                  {formatClock(nowMinutes)}
                </div>
              </>
            )}
          </div>

          <div className="timeline-gaps">
            {gaps.map(gap => {
              const top = vertical.topPx(gap.startMinutes)
              const bottom = vertical.topPx(gap.endMinutes)
              const isOpen = openGapStart === gap.startMinutes
              const label = `${formatDuration(gap.minutes)} free, ${formatClock(gap.startMinutes)} to ${formatClock(gap.endMinutes)}. Tap to fill this time.`
              return (
                <button
                  key={`gap-${gap.startMinutes}`}
                  type="button"
                  className="timeline-gap"
                  data-gap-start={gap.startMinutes}
                  aria-label={isEmptyDay ? 'Nothing placed yet. Tap to put a task on the clock.' : label}
                  aria-haspopup="dialog"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGapStart(isOpen ? null : gap.startMinutes)}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(bottom - top, GAP_MIN_HEIGHT_PX)}px`,
                    left: `${GUTTER_PX}px`,
                    width: `calc(100% - ${GUTTER_PX}px)`,
                  }}
                >
                  {/* On a day with nothing placed yet the single gap is the
                      whole waking window, and "16h free" is a true but
                      useless thing to say to somebody looking at nine untimed
                      tasks. It says what to do instead. */}
                  {isEmptyDay ? (
                    <span className="timeline-gap-label timeline-gap-empty" aria-hidden="true">
                      Nothing placed yet - tap anywhere to put something here
                    </span>
                  ) : (
                    gap.minutes >= MIN_LABELLED_GAP_MINUTES && (
                      <span className="timeline-gap-label" aria-hidden="true">{formatDuration(gap.minutes)} free</span>
                    )
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* The one thing worth saying about the greyed band above out loud -
          see docs/RESEARCH-ADHD.md section 7 and the note on the band's own
          layer: the band itself is decorative (a sighted eye already reads
          grey against the hour grid), but the boundary it marks is real
          information, said here once in plain text rather than announced
          once per band or left for a screen reader to infer from color it
          cannot perceive. Rendered every time the grid itself is, even on a
          day whose display window happens not to reach the boundary today -
          the setting is still true regardless of what today's anchors leave
          room to show. */}
      <p className="visually-hidden">Asleep from {formatClock(waking.end)} to {formatClock(waking.start)}.</p>

      {unsizedAnchorCount > 0 && (
        <p className="timeline-note">Gaps aren't shown - not every timed task above has a size yet.</p>
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
