import { useAppData } from '../lib/store'

import { TimelineGrid } from '../widgets/day-plan/TimelineGrid'
import { formatDuration, windowFor } from '../widgets/day-plan/capacity'
import { blocksAsTasks, overlapsIn, templateSummary, type DrawableBlock } from './templateDay'

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
}

export function TemplateTimeline({ blocks, sleepProfileId, color, weekday, compact }: TemplateTimelineProps) {
  const data = useAppData()
  const mine = weekday === undefined ? blocks : blocks.filter(b => b.weekday === weekday)
  const tasks = blocksAsTasks(blocks, weekday)
  const window = windowFor(sleepProfileId, { profiles: data.settings.sleepProfiles })
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
        sleep={{ profiles: data.settings.sleepProfiles }}
        clashIds={clashes.flatMap(c => c.ids)}
        hideHours={compact}
        isToday={false}
        isWide={!compact}
      />
      <p className="template-timeline-summary" role="status">
        {line}
      </p>
    </div>
  )
}
