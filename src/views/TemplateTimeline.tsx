import { useAppData } from '../lib/store'
import type { SleepWindow } from '../lib/types'

import { TimelineGrid } from '../widgets/day-plan/TimelineGrid'
import { useTimelineDrag } from '../widgets/day-plan/useTimelineDrag'
import { formatDuration, wakingDayFor } from '../widgets/day-plan/capacity'
import { blocksAsTasks, nightLine, overlapsIn, templateSummary, type DrawableBlock } from './templateDay'

/**
 * The template, drawn as the day it makes.
 *
 * The owner's words while building one: you want to see not only the items
 * but the timeline, how each one falls, with the sleep you have chosen. A
 * list of blocks answers "what is on this day"; only the picture answers
 * "is there room for it", which is the question a template is actually
 * about.
 *
 * Three deliberate things here.
 *
 * **It is the same grid the day view draws**, from the same component with
 * the same hour scale, the same block colours and the same gap labels. A
 * second, simplified drawing of a day would drift from the real one, and
 * then a template would look like something the day does not.
 *
 * **Sleep is drawn first**, from the profile this template or column
 * carries, so the picture starts at waking and ends at sleep. Changing the
 * profile redraws it, which is the whole point: it is how somebody sees how
 * much day they actually have before deciding what goes in it.
 *
 * **An overlap is shown, never prevented.** Two blocks on the same minutes
 * may be meant - a commute that runs into the start of a shift is a real
 * Tuesday - so the line says which and Save is untouched.
 *
 * A picture and nothing else in v2.5: blocks are not dragged in it. That is
 * in STATE's "Asked for, not yet built".
 */

export interface TemplateTimelineProps {
  blocks: DrawableBlock[]
  /** The sleep schedule this template or column is measured against. */
  sleepProfileId?: string
  /** The template's own colour, so its blocks read the way its day will. */
  color?: string
  /** One column of a week template. Absent draws every block. */
  weekday?: number
  /** A short summary instead of the full line, for a narrow week column. */
  compact?: boolean
  /**
   * The name this timeline answers to when a time is being chosen against it
   * - see `lib/timeGhost.ts`. 'template' for the day editor, and one per
   * weekday in the week editor, so a time picked for Wednesday is drawn on
   * Wednesday and on no other column.
   */
  ghostKey?: string
  /**
   * Given, the picture can be edited by hand: a block dragged to another
   * hour, or its bottom edge dragged to another length, and the change
   * comes here as a patch on the block's id. Absent, the picture is what it
   * was since v2.5 - a drawing of the day the blocks make.
   *
   * The id is the block's own where it has one, and `draft-N` for the Nth
   * block of a draft that has not been saved yet - see `drawable` in
   * TemplatesView, which hands the index in for exactly this.
   */
  onReshape?: (blockId: string, patch: { time?: string; minutes?: number }) => void
  /**
   * The schedule's window as it is being set in the editor, before it is
   * saved - rotating shifts, stage 8. Given, the picture sleeps on this rather
   * than on what the schedule holds, so moving a bedtime moves the band at once.
   */
  sleepWindow?: SleepWindow
}

export function TemplateTimeline({ blocks, sleepProfileId, color, weekday, compact, ghostKey, onReshape, sleepWindow }: TemplateTimelineProps) {
  const data = useAppData()
  // The schedules, with the one being edited carrying the window from the
  // editor rather than the one it was saved with.
  const drawnOn = sleepProfileId ?? data.settings.sleepProfiles[0]?.id
  const profiles = sleepWindow
    ? data.settings.sleepProfiles.map(p => (p.id === drawnOn ? { ...p, window: sleepWindow } : p))
    : data.settings.sleepProfiles
  const column = weekday === undefined ? blocks : blocks.filter(b => b.weekday === weekday)
  // The picture is the template's own day. A block on the next day is the
  // morning after's, and is said under it rather than drawn at its hour here
  // - section 10 of RESEARCH-SHIFTS.
  const mine = column.filter(b => !b.afterMidnight)
  const night = nightLine(column)
  const tasks = blocksAsTasks(mine)
  // The same two gestures the day view has, on the same grid, through the
  // same hook - bound to the draft rather than to a date. No tray here, so
  // no drop can take a time off; and no undo, because the editor's own
  // Cancel is the way back from anything done to a draft.
  const drag = useTimelineDrag({
    tasks,
    reshape: (id, patch) => {
      if (!onReshape) return false
      onReshape(id, patch)
      return true
    },
  })
  const live = onReshape !== undefined
  // The whole waking day, to the schedule's next sleep - past midnight for a
  // bedtime after it - so the sleep figure is the schedule's own sleep and not
  // a day less a waking window cut at midnight.
  const window = wakingDayFor(sleepProfileId, { profiles }).waking
  const summary = templateSummary(mine, window)
  const clashes = overlapsIn(mine)

  const line = compact
    ? `${formatDuration(summary.timedMinutes)} / ${summary.keyCount} key`
    : `Timed ${formatDuration(summary.timedMinutes)} - Free ${formatDuration(summary.freeMinutes)} - Sleep ${formatDuration(summary.sleepMinutes)} - ${summary.keyCount} key`

  return (
    <div className={compact ? 'template-timeline is-compact' : 'template-timeline'}>
      {clashes.length > 0 && (
        <p className="template-timeline-clash" role="status">
          {clashes.length === 1
            ? `${clashes[0].ids.length} blocks overlap ${clashes[0].from}-${clashes[0].to}`
            : `${clashes.length} places where blocks overlap`}
        </p>
      )}
      <TimelineGrid
        tasks={tasks}
        categories={data.categories}
        templateColor={color}
        sleepProfileId={sleepProfileId}
        sleep={{ profiles }}
        clashIds={clashes.flatMap(c => c.ids)}
        ghostKey={ghostKey}
        hideHours={compact}
        isToday={false}
        isWide={!compact}
        onAnchorPointerDown={live ? drag.startDrag : undefined}
        onAnchorResizePointerDown={live ? drag.startResize : undefined}
        onGeometry={live ? drag.onGeometry : undefined}
        draggingTaskId={live ? drag.draggingTaskId : undefined}
        dropMinutes={live ? drag.dropMinutes : undefined}
      />
      {live && (
        <p className="visually-hidden" aria-live="polite">
          {drag.announcement}
        </p>
      )}
      {night && !compact && <p className="template-timeline-night">{night}</p>}
      <p className="template-timeline-summary" role="status">
        {line}
      </p>
    </div>
  )
}
