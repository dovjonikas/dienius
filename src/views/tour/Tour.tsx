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
 * has, the card shows a tick for a beat and moves on. There is no Next, except
 * on the two steps that earn one - see `outcome` in lib/tour.ts.
 *
 * The spotlight is one SVG path with an even-odd hole, and it never catches
 * a pointer event: it dims, the ring points, and the whole app stays usable
 * underneath. The person clicks the actual button and types in the actual
 * box, and the app does the actual thing - a fake copy of the control inside
 * the overlay would teach a fake app, and a scrim that blocked clicks trapped
 * people inside the first sheet the tour led them into.
 *
 * Three things guard against the failure this design invites, which is a step
 * that never ends:
 *
 * 1. **The hole follows.** The target is scrolled into view before it is
 *    measured, and re-measured on a resize, on a scroll, on any DOM mutation,
 *    and on a slow poll besides. The poll is not redundant: a CSS transition
 *    moves an element without mutating anything, and a bottom sheet sliding up
 *    over a quarter of a second is exactly that.
 * 2. **A target that never appears is skipped**, after a grace period long
 *    enough to cover a tab switch and a sheet animation. A step pointing at
 *    nothing forever is worse than a step nobody saw.
 * 3. **A step that has not ended in twenty seconds offers a way through** -
 *    do it for me, or skip it. See lib/tourAssist.ts.
 */

export interface TourProps {
  /** Switch the shell to a tab. A step lives on one, and the engine gets there itself. */
  onNavigate: (view: TourView) => void
}

/**
 * How long the tick is shown before the next step.
 *
 * Was 650ms, which measured as "long enough to be seen" on a screen somebody
 * was already staring at and was not: the thing being celebrated happens
 * somewhere else on the page, and the eye has to travel to it and back. At
 * 650ms people reported steps "jumping". A beat and a bit is the floor.
 */
const ADVANCE_DELAY_MS = 1200

/** How often the target is re-measured. Scroll, resize and mutations also trigger it; this catches motion. */
const POLL_MS = 200

/**
 * How long a step waits for its target to turn up before saying so. Long
 * enough for a tab switch and a bottom sheet's slide, short enough that
 * nobody has decided the app is broken.
 */
const MISSING_TARGET_GRACE_MS = 2500

/**
 * How long after that the step gives up and moves on by itself.
 *
 * The gap between the two is the whole point, and it was found by running the
 * tour at eleven at night. The Focus step points at a button that only exists
 * on the *running* card; past bedtime the day is over, quick-add honestly
 * offers no time, the task it asks for is a float, and there is no running
 * card at all. Skipping straight past that means somebody who started the
 * tour in the evening never sees Focus and is never told why. So a missing
 * target first offers the way through - do it for me, which starts Focus on
 * the task the tour made - and only moves on if nobody takes it.
 */
const MISSING_TARGET_SKIP_MS = 12_000

/** How long a step waits for the person before offering to do it for them. */
const STUCK_AFTER_MS = 20_000

/** Breathing room between the target's box and the edge of the hole. */
const HOLE_PAD = 6

const CARD_WIDTH = 300

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
  const targetRef = useRef<Element | null>(null)
  const lastScrollRef = useRef(0)
  const missingSinceRef = useRef<number | null>(null)

  const advance = useCallback(() => setTourStep(index + 1), [index])

  useEffect(() => {
    setBefore({ step: index, data: getData() })
    setCelebrating(false)
    setStuck(false)
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
  // A step carrying an `outcome` stops here rather than advancing: something
  // has just appeared on the screen and the card names it, which is a thing
  // to read, not a thing to catch sight of on the way past.
  useEffect(() => {
    if (!celebrating || step.outcome) return
    const timer = setTimeout(advance, ADVANCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [celebrating, advance, step.outcome])

  // --- has it been too long? ----------------------------------------------

  useEffect(() => {
    if (celebrating || step.event === 'start' || step.event === 'finish') return
    const timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [celebrating, index, step.event])

  // --- where is the target? ------------------------------------------------

  const taskId = tourTask(data, today)?.id ?? ''

  useEffect(() => {
    if (step.targets.length === 0) return
    let observed: Element | null = null

    function measure() {
      // Two questions, and they are not the same one. *Present* is whether
      // the element is in the document at all; *found* is whether it is also
      // laid out, which is what a hole can be drawn around. A control inside
      // a sheet that is still sliding up is present and not yet found, and
      // waiting for it is right. A control that is not in the document is not
      // coming.
      let present = false
      let found: Element | null = null
      for (const selector of step.targets) {
        const el = document.querySelector(selector.replace('{task}', taskId))
        if (!el) continue
        present = true
        if ((el as HTMLElement).offsetParent !== null) found = el
      }

      if (!present) {
        if (targetRef.current) {
          targetRef.current = null
          setHole(null)
        }
        // Nothing to point at, and nothing on its way. A grace period first,
        // in case a tab is still switching; then the way through is offered,
        // because a step whose control is genuinely not in this state - a
        // different viewport, a condition that was never met - would otherwise
        // hold somebody at a spotlight that never appears, with a card naming
        // a button that is not on the screen. Only if nobody takes the offer
        // does the step move on by itself.
        const since = missingSinceRef.current ?? Date.now()
        missingSinceRef.current = since
        const waited = Date.now() - since
        if (waited > MISSING_TARGET_GRACE_MS) setStuck(true)
        if (waited > MISSING_TARGET_SKIP_MS) {
          console.info(`[tour] step "${step.id}" has no target on this screen; skipping it.`)
          advance()
        }
        return
      }
      missingSinceRef.current = null
      if (!found) return

      if (found !== observed) {
        resizeObserver?.disconnect()
        resizeObserver?.observe(found)
        observed = found
      }

      const r = found.getBoundingClientRect()
      // Scrolled into view when first found, and again if it is off screen
      // later: a bottom sheet slides up over a quarter of a second, and a
      // control inside it measured mid-slide is below the viewport, so the
      // first scroll lands on nothing. Throttled, or a control that genuinely
      // cannot be scrolled to would be fought over every poll.
      const offScreen = r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth
      const now = Date.now()
      if (found !== targetRef.current || (offScreen && now - lastScrollRef.current > 500)) {
        targetRef.current = found
        lastScrollRef.current = now
        found.scrollIntoView({ block: 'center', inline: 'nearest' })
        return
      }
      const next = { x: r.left - HOLE_PAD, y: r.top - HOLE_PAD, w: r.width + HOLE_PAD * 2, h: r.height + HOLE_PAD * 2 }
      setHole(prev => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next))
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
    // transition at all, since moving an element mutates nothing.
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(records => {
            // The overlay's own churn - the ring moving, the tick animating,
            // the card resizing - is not news about the target. Ignoring it
            // keeps the common case at zero measures rather than one a frame
            // for as long as the tour is open.
            if (records.every(record => (record.target as Element).closest?.('.tour'))) return
            schedule()
          })
    mutationObserver?.observe(document.body, { childList: true, subtree: true, attributes: true })

    measure()
    const timer = setInterval(measure, POLL_MS)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      clearInterval(timer)
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [step, taskId, advance])

  // --- the ends -----------------------------------------------------------

  function finish(outcome: 'keep' | 'clean') {
    leaveTour(outcome)
  }

  function skip() {
    finish('keep')
  }

  function doItForMe() {
    // Falls through to skipping when there is nothing sensible to do on
    // somebody's behalf - assistWith says so rather than pretending.
    if (!assistWith(step.event, today)) advance()
  }

  const text = resolveText(step.text, new Date())
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
      <p className="tour-text">
        {isFinish && sandbox ? 'This was a sandbox. Nothing here is kept.' : showingOutcome ? step.outcome : text}
      </p>
      {/* Only after twenty seconds of nothing happening, and never shouted:
          it is an admission that something may be wrong, offered quietly to
          the one person in ten who needs it rather than waved at everybody
          else as a way to not bother. */}
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
