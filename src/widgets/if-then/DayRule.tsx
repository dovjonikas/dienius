import { useEffect, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { pickIfThenRule, timeBandFor } from './select'
import { IfThenSheet } from './IfThenSheet'

export interface IfThenDayRuleProps {
  date: string
}

/**
 * The one if-then rule surfaced on the day view - docs/TIMELINE.md
 * section 6, and the reasoning behind moving it here at all is
 * docs/RESEARCH-ADHD.md sections 1 and 2: a rule filed in its own tab is a
 * plan stored elsewhere, and the trigger fires exactly when a person is
 * not in a state to go looking for it. A rule seen daily on the screen
 * already open is also a rule rehearsed, which the same research names as
 * the one thing that makes an implementation intention's effect larger.
 *
 * Quiet on purpose: this renders as one plain line under the capacity
 * line, no color, no icon, nothing that reads as a warning or a task -
 * tapping it opens the full list (`IfThenSheet`), which is where editing
 * lives. Renders nothing at all when there is no eligible rule for today,
 * exactly like the capacity line and the timeline toggle above it already
 * do when there is nothing to say.
 *
 * Self-contained, like `IfThenBoard` used to be as its own widget: reads
 * its own slice of the store rather than taking entries as a prop, so
 * `DayView` only has to know a date, not anything about if-then data.
 */
export function IfThenDayRule({ date }: IfThenDayRuleProps) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const dayType = data.days[date]?.dayType ?? 'full'
  const band = timeBandFor(new Date())
  const rule = pickIfThenRule(data.ifThens, dayType, band, date)

  // Records the pick as scheduling metadata, once - see
  // `IfThenEntry.lastSurfaced` and `pickIfThenRule`'s own stability rule.
  // Guarded on `lastSurfaced !== date` so this only ever commits once per
  // rule per date: without the guard, marking the rule would change
  // `data.ifThens`, which would re-run this effect, which would mark it
  // again, forever.
  useEffect(() => {
    if (!rule || rule.lastSurfaced === date) return
    actions.markIfThenSurfaced(rule.id, date)
  }, [rule, date])

  // Computed once and reused below rather than repeated per branch: every
  // branch has to keep an already-open sheet mounted on its own terms,
  // including the "nothing to say" branch at the bottom - writing the
  // first entry from inside the sheet is itself what can turn
  // `data.ifThens.length` from zero to one mid-session, and if that entry
  // is not eligible for the current moment (a rule scoped to a different
  // time band, say), `rule` stays null right as the sheet is still open.
  // Without sharing this, that branch would unmount the sheet the moment
  // it happened, closing it out from under whoever is still writing a
  // second entry inside it.
  const sheet = open && <IfThenSheet onClose={() => setOpen(false)} />

  if (rule) {
    return (
      <>
        <button
          type="button"
          className="day-rule"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`If ${rule.trigger}, then ${rule.action}. Open if-then rules.`}
          onClick={() => setOpen(true)}
        >
          <span className="day-rule-line" aria-hidden="true">
            <span className="if-then-prefix">If</span>
            {rule.trigger}
          </span>
          <span className="day-rule-line" aria-hidden="true">
            <span className="if-then-prefix">Then</span>
            {rule.action}
          </span>
        </button>
        {sheet}
      </>
    )
  }

  // No rule eligible for this exact moment. Unlike the capacity line or
  // the timeline toggle above it - whose own "nothing to say" state
  // genuinely has nothing behind it - an if-then rule has to be authored
  // somewhere before it can ever surface, and `IfThenSheet` is the only
  // place that form lives. It has no other opener anywhere in the app:
  // without this, a fresh install (or a device that just had everything
  // erased) could never write its first rule at all. Shown only for a
  // genuinely empty install - the same first-run-only condition the day
  // view's own starter offers already use, see `DayView.tsx`'s
  // `firstRun` - so the moment a real entry exists anywhere, this reverts
  // to the same silence every other "nothing eligible today" case already
  // keeps, still carrying the sheet along if it happens to be open.
  if (data.ifThens.length === 0) {
    return (
      <>
        <button
          type="button"
          className="day-rule day-rule-empty"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span className="day-rule-line">No if-then rules yet - add one</span>
        </button>
        {sheet}
      </>
    )
  }

  return sheet
}
