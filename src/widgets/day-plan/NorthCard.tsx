import { useEffect, useRef } from 'react'
import type { Goal, IfThenEntry } from '../../lib/types'
import { actions, useAppData } from '../../lib/store'
import { deserveForWeek, northPrompt, ruleForDay } from '../../lib/north'
import { todayKey } from '../../lib/dates'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { RuleText } from '../../views/north/NorthView'

/**
 * The one time a goal comes forward on its own.
 *
 * Two occasions, both of them mornings: after a day that got away, and at the
 * start of a week. What it shows is the goal and its reason in full - the
 * commitment, restated. What it does not show is anything about yesterday. No
 * count of what was missed, no percentage, no red, no "you didn't". The app
 * knows exactly how the day went and says none of it, because the moment this
 * card contains a number about the past it becomes a report card, and a
 * report card from a planner is a planner people stop opening.
 *
 * The tone to hold: this is a note from somebody to themselves, written on a
 * better morning. It is allowed to be warm. It is not allowed to be a system
 * telling you off.
 *
 * The one rule under the why is the second and last place a rule appears -
 * the other is the North window. It is the person's own sentence, chosen the
 * same way the goal is: deterministically from the date, so it is the same
 * line all day. It is introduced as theirs rather than as advice, because the
 * difference between "here is what you wrote yourself" and an app suggesting
 * what to do on a bad morning is the difference between this card working and
 * this card being closed.
 *
 * One button. Dismissing is remembered for the day only - tomorrow is a
 * different morning and will decide again on its own terms. It is remembered
 * in settings, which sync, because "I have read this today" is a fact about
 * the person and not the device: the laptop dismissing it should be enough
 * for the phone. The card wrote a local key instead from v1.4 to v1.11, so
 * the field that was built for it sat empty and the phone asked again.
 *
 * ## A sheet over the day, since v2.6
 *
 * It stood in the flow between the header and the day until then, and on a
 * 768px screen it took a fifth of the day away: the timeline and the list
 * squeezed under it, and after Ok everything jumped back up. The owner's
 * words were that it did not feel clean, and offered two shapes - a sheet
 * with the backdrop every other sheet has, or a one-line strip. It is a
 * sheet, because it is a moment rather than a state: shown once on a Monday
 * or the morning after a day that got away, read once, gone in one press,
 * which is exactly what the task sheet and the replan sheet are for. A strip
 * could hold the goal's name and nothing else, and the why and the identity
 * are the card. Every way out of it - Close, Escape, the backdrop - is the same
 * "I have read this", because there is nothing else it could mean. The
 * evening close stays in the flow: it arrives at a set time while somebody
 * may be typing, and a sheet that lands mid-sentence is worse than a card
 * that pushes. See DECISIONS "Nothing moves on hover".
 */
export function NorthCard() {
  const data = useAppData()
  const today = todayKey()
  const prompt = northPrompt(data, today, data.settings.northDismissedOn ?? null)
  if (!prompt) return null
  return <NorthSheet goal={prompt.goal} kind={prompt.kind} ifThens={data.ifThens} today={today} />
}

function NorthSheet({ goal, kind, ifThens, today }: { goal: Goal; kind: 'slack' | 'monday'; ifThens: IfThenEntry[]; today: string }) {
  // Focus comes to the sheet, and goes back to wherever it was when the
  // sheet closes - CONVENTIONS section 6, a sheet hands focus back. The
  // sheet rather than its one button: a focus ring on Ok the moment the
  // card opened read as the card pointing at itself.
  useRestoreFocus()
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  // On both cards.
  //
  // It was the slack card's alone until this wave, on the argument that a
  // Monday is a morning with nothing behind it yet. That is right about
  // repair and wrong about the thing a rule actually is: an implementation
  // intention works by loading the if-then link *before* the moment, and
  // Gollwitzer and Sheeran's whole finding is that a plan rehearsed at least
  // once does more than a plan written once. A Monday is the better of the
  // two mornings for that, not the worse one.
  //
  // And without it the rehearsal never happened for anybody having a decent
  // month: the card only appears on a Monday or after a day that got away,
  // so a person whose days do not get away saw their rules exactly nowhere
  // outside the North window. See docs/STATE.md.
  const rule = ruleForDay(ifThens, goal.id, today)
  // Only on the Monday card, and one line: what this week is for, in the
  // person's own words. The slack card carries a rule instead - a morning
  // after a day that got away wants what to do about the moment; a Monday
  // wants what to do with the week. The same line every day of that week -
  // see deserveForWeek - and never a word about whether last week's happened.
  const line = kind === 'monday' ? deserveForWeek(goal, today) : undefined

  function dismiss() {
    actions.dismissNorth(today)
  }

  return (
    <div className="north-scrim" onClick={dismiss}>
      <div
        ref={cardRef}
        className={kind === 'monday' ? 'north-card is-monday' : 'north-card'}
        role="dialog"
        aria-modal="true"
        aria-label="Why this matters"
        tabIndex={-1}
        data-keeps-keys=""
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          dismiss()
        }}
      >
        {/* A lead, not a sentence, so no stop - see CONVENTIONS on what ends
            in a full stop and what does not. */}
        <p className="north-card-lead">{kind === 'monday' ? 'New week' : 'A reminder of why'}</p>
        <h2 className="north-card-title">{goal.title}</h2>
        {goal.why && <p className="north-card-why">{goal.why}</p>}
        {goal.identity && <p className="north-card-identity">{goal.identity}</p>}
        {line && (
          <p className="north-card-deserve">
            <span className="north-card-rule-lead">This week</span>
            {line}
          </p>
        )}
        {/* The sentence itself comes from RuleText, which is the one place
              this app draws a rule. It was hand-rolled here as well until
              this wave, and the two copies had already drifted: v2.19 turned
              the arrow between the halves into the word it stood for on the
              North page, and this one still drew an arrow. CONVENTIONS 23,
              found by asking where a rule shows up after it is written. */}
        {rule && (
          <div className={kind === 'monday' ? 'north-card-rule is-monday' : 'north-card-rule'}>
            {/* The lead is the slack card's. It exists because on the morning
                after a day that got away, the difference between "here is
                what you wrote yourself" and an app suggesting what to do is
                the difference between this card working and this card being
                closed. A Monday has nothing to defend against, so the
                sentence stands on its own there. */}
            {kind === 'slack' && <span className="north-card-rule-lead">Here is what you wrote yourself.</span>}
            <RuleText rule={rule} />
          </div>
        )}
        <button type="button" className="north-card-ok" onClick={dismiss}>
          Close
        </button>
      </div>
    </div>
  )
}
