import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getData, useAppData } from '../../lib/store'
import { useClockTools } from '../../lib/clockTools'
import { todayKey } from '../../lib/dates'
import { useIsWide } from '../../lib/viewport'
import { isTourSandbox } from '../../lib/tourMode'
import { endTour, readProgress, setTourStep, startTour, useTourState } from '../../lib/tourState'
import { leaveTour } from '../../lib/tourExit'
import { assistWith } from '../../lib/tourAssist'
import { TOUR_EVENTS, resolveText, stepsFor, tourTask, type TourStep, type TourView } from '../../lib/tour'
import { CARD_GAP, placeCard, type Rect } from './cardPlacement'
import type { AppData } from '../../lib/types'

/**
 * The tour engine: a spotlight, a card, and a predicate.
 *
 * It knows nothing about what it teaches. It takes the step array for this
 * platform from lib/tour.ts, points at whatever the step names, and asks the
 * step's event whether it has happened yet, on every store change. When it
 * has, the card shows a tick, names what happened, and moves on. There is a
 * Next during every caption, and three steps wait for it - see `outcome` in
 * lib/tour.ts.
 *
 * The spotlight is one SVG path with an even-odd hole, and it never catches
 * a pointer event: it dims, the ring points, and the whole app stays usable
 * underneath. The person clicks the actual button and types in the actual
 * box, and the app does the actual thing - a fake copy of the control inside
 * the overlay would teach a fake app, and a scrim that blocked clicks trapped
 * people inside the first sheet the tour led them into.
 *
 * Three standing rules about the thing being pointed at, each the fix for a
 * walk the owner watched go wrong:
 *
 * 1. **It is visible.** The lit target carries `is-tour-target`, which
 *    outranks every hover reveal in the stylesheet. The dots on a task card
 *    are opacity zero on a mouse until the pointer is over the card, and the
 *    first version drew a ring around a button nobody could see.
 * 2. **It is not behind a sheet.** A modal the last step led into (`[data-tour-modal]`)
 *    that does not hold this step's control gets its close button lit and a
 *    line saying so, because "click the checkbox on Walk" under a detail
 *    panel that covers the list is an instruction nobody can follow.
 * 3. **It says what to do now.** A target can carry its own line, and a box
 *    a second one for once something is typed in it - the words track where
 *    the person actually is, not where the step began.
 *
 * And three guards against a step that never ends:
 *
 * 1. **The hole follows.** The target is scrolled into view before it is
 *    measured, and re-measured on a resize, on a scroll, on any DOM mutation,
 *    on typing, and on a slow poll besides. The poll is not redundant: a CSS
 *    transition moves an element without mutating anything, and a bottom
 *    sheet sliding up over a quarter of a second is exactly that.
 * 2. **A target that never appears is said so**, after a grace period long
 *    enough to cover a tab switch and a sheet animation, with the way
 *    through beside it. The step never moves on by itself: that used to
 *    happen after twelve seconds, and to the person it was the tour
 *    skipping at random.
 * 3. **A step that has not ended in twenty seconds offers a way through** -
 *    do it for me, or skip it. See lib/tourAssist.ts.
 */

export interface TourProps {
  /** Switch the shell to a tab. A step lives on one, and the engine gets there itself. */
  onNavigate: (view: TourView) => void
}

/**
 * How long the tick and the caption are held before the next step, on the
 * steps that do not wait for Next.
 *
 * The tick alone used to be held for 1.2 seconds, which was measured as
 * "long enough to be seen" and was not: the thing being celebrated happens
 * somewhere else on the page, the eye has to travel there and back, and then
 * there is a line to read. A beat for the tick and two seconds for twelve
 * words. Next is there throughout for anybody faster than that.
 */
const OUTCOME_HOLD_MS = 3200

/** How often the target is re-measured. Scroll, resize and mutations also trigger it; this catches motion. */
const POLL_MS = 200

/**
 * How long a step waits for its target to turn up before saying so. Long
 * enough for a tab switch and a bottom sheet's slide, short enough that
 * nobody has decided the app is broken.
 */
const MISSING_TARGET_GRACE_MS = 2500

/** How long a step waits for the person before offering to do it for them. */
const STUCK_AFTER_MS = 20_000

/** Breathing room between the target's box and the edge of the hole. */
const HOLE_PAD = 6

const CARD_WIDTH = 300

/** The class the lit target carries - see the first standing rule above, and .is-tour-target in styles.css. */
export const LIT_CLASS = 'is-tour-target'

/** What the card says while pointing at a sheet's close button - the second standing rule. */
const BLOCKED_TEXT = 'Close this panel first.'

/** What the card says when a step has no target on this screen and no better explanation of its own. */
const ABSENT_TEXT = 'That control is not on this screen right now.'

/**
 * Where the person is within a step, as far as the card can tell from the
 * page: which target is lit and whether it holds typed text, a modal in the
 * way, or nothing to point at.
 */
type Phase = { kind: 'target'; index: number; typed: boolean } | { kind: 'blocked' } | { kind: 'absent' }

function samePhase(a: Phase | null, b: Phase | null): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  return a.kind !== 'target' || b.kind !== 'target' || (a.index === b.index && a.typed === b.typed)
}

function holdsText(el: Element): boolean {
  return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value.trim() !== ''
}



export function Tour({ onNavigate }: TourProps) {
  const tour = useTourState()
  const isWide = useIsWide()
  const platform = isWide ? 'desktop' : 'mobile'
  const [declined, setDeclined] = useState(false)

  // A replay from Settings reloads into the sandbox, and the sandbox has one
  // job: it starts the tour by itself.
  useEffect(() => {
    if (!isTourSandbox() || tour.active) return
    // A reload inside the sandbox picks up where it was: the sandbox still
    // holds the stamped day, so starting over would point at a starter offer
    // that is no longer on screen.
    const progress = readProgress()
    startTour(platform, progress && 'step' in progress ? progress.step : 0)
    // Once, on mount: the platform at first paint is the one the sandbox runs on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (tour.active) return <TourOverlay onNavigate={onNavigate} />

  if (declined || isTourSandbox()) return null
  const progress = readProgress()
  if (!progress || !('step' in progress) || progress.step === 0) return null

  // Left half way - the phone locked, the tab closed. Offered, not resumed:
  // whatever the person opened the app to do now comes first.
  return (
    <div className="tour-offer" role="status">
      <span>Pick the tour up where you left it?</span>
      <button type="button" className="btn-primary" onClick={() => startTour(platform, progress.step)}>
        Continue
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          endTour()
          setDeclined(true)
        }}
      >
        No thanks
      </button>
    </div>
  )
}

function TourOverlay({ onNavigate }: TourProps) {
  const tour = useTourState()
  const data = useAppData()
  const tools = useClockTools()
  const isWide = useIsWide()
  const steps = stepsFor(tour.platform)
  const index = Math.min(tour.step, steps.length - 1)
  const step = steps[index]
  const today = todayKey()
  const sandbox = isTourSandbox()

  // The plan as it was when this step began, tagged with the step it belongs
  // to. The tag matters: for one render after a step changes the old snapshot
  // is still here, and "more tasks than before" against a snapshot from two
  // steps ago would end the new step before it started.
  const [before, setBefore] = useState<{ step: number; data: AppData }>(() => ({ step: index, data: getData() }))
  const [celebrating, setCelebrating] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [hole, setHole] = useState<Rect | null>(null)
  const [phase, setPhase] = useState<Phase | null>(null)
  const targetRef = useRef<Element | null>(null)
  const lastScrollRef = useRef(0)
  const missingSinceRef = useRef<number | null>(null)
  // Read by the measurer, which is not re-created when the tick lands: a
  // target that goes away *after* the step has ended is not a missing
  // target, it is the ticked row folding into Done, and the ring goes with
  // it rather than staying drawn around whatever slid into its place.
  const celebratingRef = useRef(false)
  celebratingRef.current = celebrating

  const advance = useCallback(() => setTourStep(index + 1), [index])

  useEffect(() => {
    setBefore({ step: index, data: getData() })
    setCelebrating(false)
    setStuck(false)
    setPhase(null)
    targetRef.current = null
    missingSinceRef.current = null
    setHole(null)
    onNavigate(step.view)
    // onNavigate is the shell's setter and stable for the life of the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // --- is the step done? -----------------------------------------------

  useEffect(() => {
    if (celebrating || before.step !== index) return
    const done = TOUR_EVENTS[step.event]({ before: before.data, now: data, today, focusRunning: tools.focus !== null })
    if (done) setCelebrating(true)
  }, [data, tools.focus, before, celebrating, index, step.event, today])

  // Its own effect, keyed on the tick alone. Inside the check above the
  // timer was cleared by the effect's own cleanup the moment `celebrating`
  // flipped, and the tour showed a tick forever.
  //
  // A caption that relocates takes the shell with it: the goal step is
  // written in Settings and lives under the day's title, and the person is
  // shown where it went rather than told.
  //
  // Guarded on the snapshot's step for the same reason the done-check is:
  // for one render after a step advances, `celebrating` is still the last
  // step's and `step` is already the next one. Without the guard the goal
  // step's relocation fired the moment the library step ended, sent the
  // shell to the day view on top of the index effect's `settings`, and the
  // card sat on the wrong tab saying its control was not on the screen.
  useEffect(() => {
    if (!celebrating || before.step !== index) return
    if (step.outcome?.view) onNavigate(step.outcome.view)
    if (step.outcome?.wait) return
    const timer = setTimeout(advance, OUTCOME_HOLD_MS)
    return () => clearTimeout(timer)
    // onNavigate is stable - see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrating, advance, step.outcome, before.step, index])

  // --- has it been too long? ----------------------------------------------

  useEffect(() => {
    if (celebrating || step.event === 'start' || step.event === 'finish') return
    const timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [celebrating, index, step.event])

  // --- where is the target? ------------------------------------------------

  const taskId = tourTask(data, today)?.id ?? ''
  const captionTarget = celebrating ? step.outcome?.target : undefined

  useEffect(() => {
    if (step.targets.length === 0 && !captionTarget) return
    let observed: Element | null = null
    let lit: Element | null = null

    function light(el: Element | null) {
      if (el === lit) return
      lit?.classList.remove(LIT_CLASS)
      el?.classList.add(LIT_CLASS)
      lit = el
    }

    function measure() {
      // Two questions, and they are not the same one. *Present* is whether
      // the element is in the document at all; *found* is whether it is also
      // laid out, which is what a hole can be drawn around. A control inside
      // a sheet that is still sliding up is present and not yet found, and
      // waiting for it is right. A control that is not in the document is not
      // coming.
      const wanted = captionTarget ? [{ selector: captionTarget }] : step.targets
      let present = false
      let found: Element | null = null
      let foundIndex = -1
      wanted.forEach((target, i) => {
        const el = document.querySelector(target.selector.replace('{task}', taskId))
        if (!el) return
        present = true
        if ((el as HTMLElement).offsetParent !== null) {
          found = el
          foundIndex = i
        }
      })

      // A sheet or panel the last step led into, still open, with none of
      // this step's controls inside it. Its close button is the thing to
      // point at, whatever the step says - the second standing rule.
      let next: Phase | null = null
      const modals = document.querySelectorAll('[data-tour-modal]')
      const modal = modals[modals.length - 1]
      if (modal && !(found && modal.contains(found))) {
        const close = modal.querySelector('[data-tour-modal-close]')
        if (close && (close as HTMLElement).offsetParent !== null) {
          found = close
          present = true
          next = { kind: 'blocked' }
        }
      }

      // The step is done and the thing it pointed at is no longer drawn -
      // the ticked row has folded into Done. The caption stands alone: a
      // ring left where the row used to be would circle the card that
      // moved up into the gap.
      if (celebratingRef.current && !found) {
        light(null)
        targetRef.current = null
        setHole(null)
        return
      }

      if (!present) {
        light(null)
        if (targetRef.current) {
          targetRef.current = null
          setHole(null)
        }
        // Nothing to point at, and nothing on its way. A grace period first,
        // in case a tab is still switching; then the card says so and offers
        // the way through, because a step whose control is genuinely not in
        // this state - a different viewport, a condition that was never met -
        // would otherwise hold somebody at a spotlight that never appears.
        // It never moves on by itself from here.
        const since = missingSinceRef.current ?? Date.now()
        missingSinceRef.current = since
        if (Date.now() - since > MISSING_TARGET_GRACE_MS) {
          setStuck(true)
          setPhase(prev => (samePhase(prev, { kind: 'absent' }) ? prev : { kind: 'absent' }))
        }
        return
      }
      missingSinceRef.current = null
      if (!found) return
      const el: Element = found

      if (!next) next = { kind: 'target', index: foundIndex, typed: holdsText(el) }
      setPhase(prev => (samePhase(prev, next) ? prev : next))
      light(el)

      if (el !== observed) {
        resizeObserver?.disconnect()
        resizeObserver?.observe(el)
        observed = el
      }

      const r = el.getBoundingClientRect()
      // Scrolled into view if any of it is outside the window - when first
      // found, and again if it drifts off later: a bottom sheet slides up
      // over a quarter of a second, and a control inside it measured
      // mid-slide is below the viewport, so the first scroll lands on
      // nothing. Throttled, or a control that genuinely cannot be scrolled
      // to would be fought over every poll. A control already wholly on
      // screen is left where it is: centring it scrolled the whole shell,
      // header and all, to put a checkbox in the middle of the window.
      const offScreen = r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth
      const now = Date.now()
      const first = el !== targetRef.current
      if (offScreen && (first || now - lastScrollRef.current > 500)) {
        targetRef.current = el
        lastScrollRef.current = now
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        return
      }
      targetRef.current = el
      const rect = { x: r.left - HOLE_PAD, y: r.top - HOLE_PAD, w: r.width + HOLE_PAD * 2, h: r.height + HOLE_PAD * 2 }
      setHole(prev => (prev && prev.x === rect.x && prev.y === rect.y && prev.w === rect.w && prev.h === rect.h ? prev : rect))
    }

    // Everything that can ask for a re-measure goes through here, and at most
    // one measure happens per frame.
    //
    // This is not a performance nicety, it is the fix for a hang. Measuring
    // writes: it moves the hole, which is an inline style on an element inside
    // document.body, which is a mutation, which the observer below hears, which
    // measures again. The first version of this watcher locked the renderer
    // solid inside a second - a browser tab that had to be killed. Coalescing
    // into a frame bounds the loop at the refresh rate, which is exactly what
    // the poll was already doing and no worse.
    let frame = 0
    function schedule() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    // Three watchers and a poll, and each catches something the others do not.
    // The observers are the reason the hole no longer lags a layout change by
    // up to a poll interval; the poll is the reason it does not lag a CSS
    // transition at all, since moving an element mutates nothing. Typing is
    // its own event: a value changing in a box mutates no attribute, and the
    // card's line has to turn into "now press Enter" on the first keystroke,
    // not on the next poll.
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(records => {
            // The overlay's own churn - the ring moving, the tick animating,
            // the card resizing - is not news about the target. Ignoring it
            // keeps the common case at zero measures rather than one a frame
            // for as long as the tour is open. The lit class landing on the
            // target is the engine's own doing too.
            if (
              records.every(
                record =>
                  (record.target as Element).closest?.('.tour') ||
                  (record.type === 'attributes' && record.attributeName === 'class' && record.target === lit),
              )
            )
              return
            schedule()
          })
    mutationObserver?.observe(document.body, { childList: true, subtree: true, attributes: true })

    measure()
    const timer = setInterval(measure, POLL_MS)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    document.addEventListener('input', schedule, true)
    return () => {
      clearInterval(timer)
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      document.removeEventListener('input', schedule, true)
      light(null)
    }
  }, [step, taskId, advance, captionTarget])

  // --- the ends -----------------------------------------------------------

  function finish(outcome: 'keep' | 'clean') {
    leaveTour(outcome)
  }

  function skip() {
    finish('keep')
  }

  function doItForMe() {
    // Ticking off goes through the real checkbox when it is on the page, so
    // the row plays its finishing animation and folds into Done exactly as a
    // tap would make it - the caption afterwards says that is what happened,
    // and it should be true. The store action is the fallback, and what
    // every other step uses; a three-click path through a menu is not worth
    // scripting when the action underneath is one call.
    if (step.event === 'task-done' && taskId) {
      const box = document.querySelector<HTMLInputElement>(`[data-task-id="${taskId}"] input[type="checkbox"]`)
      if (box && !box.checked) {
        box.click()
        return
      }
    }
    // Falls through to skipping when there is nothing sensible to do on
    // somebody's behalf - assistWith says so rather than pretending.
    if (!assistWith(step.event, today)) advance()
  }

  const text = lineFor(step, phase, celebrating, new Date())
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight

  return (
    <div className={celebrating ? 'tour is-celebrating' : 'tour'}>
      <svg className="tour-scrim" width="100%" height="100%" aria-hidden="true">
        <path
          fillRule="evenodd"
          d={
            `M0 0H${vw}V${vh}H0Z` +
            (hole ? ` M${hole.x} ${hole.y}h${hole.w}v${hole.h}h${-hole.w}z` : '')
          }
        />
      </svg>
      {hole && <div className="tour-ring" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} aria-hidden="true" />}
      <TourCard
        step={step}
        text={text}
        index={index}
        count={steps.length}
        hole={hole}
        wide={isWide}
        celebrating={celebrating}
        stuck={stuck}
        sandbox={sandbox}
        onStart={advance}
        onNext={advance}
        onSkipStep={advance}
        onAssist={doItForMe}
        onSkip={skip}
        onFinish={finish}
      />
    </div>
  )
}

/**
 * The one line the card says, chosen from what the step offers and where
 * the person is. In order: the caption once the step has ended; the modal
 * in the way; the absence of anything to point at; the lit target's own
 * words, with the typed variant once the box has something in it; and the
 * step's line for everything else.
 */
export function lineFor(step: TourStep, phase: Phase | null, celebrating: boolean, now: Date): string {
  if (celebrating && step.outcome) return step.outcome.text
  if (phase?.kind === 'blocked') return BLOCKED_TEXT
  if (phase?.kind === 'absent') return step.absent ?? ABSENT_TEXT
  if (phase?.kind === 'target') {
    const target = step.targets[phase.index]
    if (target) {
      if (phase.typed && target.typed) return target.typed
      if (target.text) return resolveText(target.text, now)
    }
  }
  return resolveText(step.text, now)
}

interface TourCardProps {
  step: TourStep
  text: string
  index: number
  count: number
  hole: Rect | null
  wide: boolean
  celebrating: boolean
  stuck: boolean
  sandbox: boolean
  onStart: () => void
  onNext: () => void
  onSkipStep: () => void
  onAssist: () => void
  onSkip: () => void
  onFinish: (outcome: 'keep' | 'clean') => void
}

function TourCard({
  step,
  text,
  index,
  count,
  hole,
  wide,
  celebrating,
  stuck,
  sandbox,
  onStart,
  onNext,
  onSkipStep,
  onAssist,
  onSkip,
  onFinish,
}: TourCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(160)

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight)
  }, [text, step.id, celebrating, stuck])

  // Beside the hole and never over it - see cardPlacement.ts, where the
  // choice between the four sides lives as a pure function because jsdom has
  // no layout and this rule is worth a test.
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight
  const placement = placeCard(hole, { w: CARD_WIDTH, h: height }, { w: vw, h: vh }, wide)
  let style: React.CSSProperties
  switch (placement.kind) {
    case 'centre':
      style = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: CARD_WIDTH }
      break
    case 'bottom':
      style = { left: CARD_GAP, right: CARD_GAP, bottom: `calc(${CARD_GAP}px + env(safe-area-inset-bottom))` }
      break
    case 'top':
      style = { left: CARD_GAP, right: CARD_GAP, top: `calc(${CARD_GAP}px + env(safe-area-inset-top))` }
      break
    default:
      style = { left: placement.left, top: placement.top, width: CARD_WIDTH }
  }

  const isStart = step.event === 'start'
  const isFinish = step.event === 'finish'
  const showingOutcome = celebrating && !!step.outcome

  return (
    <div ref={ref} className="tour-card" role="dialog" aria-label="Tour" aria-live="polite" style={style}>
      <div className="tour-card-head">
        <h3 className="tour-title">{step.title}</h3>
        <span className={celebrating ? 'tour-tick is-on' : 'tour-tick'} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <p className={showingOutcome ? 'tour-text is-outcome' : 'tour-text'}>
        {isFinish && sandbox ? 'This was a sandbox. Nothing here is kept.' : text}
      </p>
      {/* Only after twenty seconds of nothing happening, or once the card
          has admitted there is nothing on this screen to point at - and
          never shouted: it is an admission that something may be wrong,
          offered quietly to the one person in ten who needs it rather than
          waved at everybody else as a way to not bother. */}
      {stuck && !celebrating && !isStart && !isFinish && (
        <div className="tour-stuck">
          <button type="button" className="tour-stuck-do" onClick={onAssist}>
            Do it for me
          </button>
          <button type="button" className="tour-stuck-skip" onClick={onSkipStep}>
            Skip this step
          </button>
        </div>
      )}
      <div className="tour-card-foot">
        <span className="tour-dots" aria-label={`Step ${index + 1} of ${count}`}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={i < index ? 'tour-dot is-past' : i === index ? 'tour-dot is-now' : 'tour-dot'} />
          ))}
        </span>
        <span className="tour-actions">
          {isStart && (
            <button type="button" className="btn-primary" onClick={onStart}>
              Start
            </button>
          )}
          {showingOutcome && (
            <button type="button" className="btn-primary" onClick={onNext}>
              Next
            </button>
          )}
          {isFinish && sandbox && (
            <button type="button" className="btn-primary" onClick={() => onFinish('keep')}>
              Done
            </button>
          )}
          {isFinish && !sandbox && (
            <>
              <button type="button" className="btn-primary" onClick={() => onFinish('keep')}>
                Keep what I built
              </button>
              <button type="button" className="btn-secondary" onClick={() => onFinish('clean')}>
                Start clean
              </button>
            </>
          )}
          {!isFinish && !showingOutcome && (
            <button type="button" className="tour-skip" onClick={onSkip}>
              Skip
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
