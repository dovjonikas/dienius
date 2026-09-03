import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { actions, getData, useAppData } from '../../lib/store'
import { useClockTools } from '../../lib/clockTools'
import { todayKey } from '../../lib/dates'
import { useIsWide } from '../../lib/viewport'
import { exitTourSandbox, isTourSandbox } from '../../lib/tourMode'
import { endTour, readProgress, setTourStep, startTour, useTourState } from '../../lib/tourState'
import { TOUR_EVENTS, resolveText, stepsFor, tourTask, type TourStep, type TourView } from '../../lib/tour'
import type { AppData } from '../../lib/types'

/**
 * The tour engine: a spotlight, a card, and a predicate.
 *
 * It knows nothing about what it teaches. It takes the step array for this
 * platform from lib/tour.ts, points at whatever the step names, and asks the
 * step's event whether it has happened yet, on every store change. When it
 * has, the card shows a tick for a beat and moves on. There is no Next.
 *
 * The spotlight is one SVG path with an even-odd hole, and it never catches
 * a pointer event: it dims, the ring points, and the whole app stays usable
 * underneath. The person clicks the actual button and types in the actual
 * box, and the app does the actual thing - a fake copy of the control inside
 * the overlay would teach a fake app, and a scrim that blocked clicks trapped
 * people inside the first sheet the tour led them into.
 */

export interface TourProps {
  /** Switch the shell to a tab. A step lives on one, and the engine gets there itself. */
  onNavigate: (view: TourView) => void
}

/** How long the tick is shown before the next step. Long enough to be seen, short enough to not be waited for. */
const ADVANCE_DELAY_MS = 650

/** How often the target is re-measured. Scroll and resize also trigger it; this catches everything else. */
const POLL_MS = 150

/** Breathing room between the target's box and the edge of the hole. */
const HOLE_PAD = 6

const CARD_WIDTH = 300
const CARD_GAP = 12

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

interface Hole {
  x: number
  y: number
  w: number
  h: number
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
  const [hole, setHole] = useState<Hole | null>(null)
  const targetRef = useRef<Element | null>(null)
  const lastScrollRef = useRef(0)

  useEffect(() => {
    setBefore({ step: index, data: getData() })
    setCelebrating(false)
    targetRef.current = null
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
  useEffect(() => {
    if (!celebrating) return
    const timer = setTimeout(() => setTourStep(index + 1), ADVANCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [celebrating, index])

  // --- where is the target? ------------------------------------------------

  const taskId = tourTask(data, today)?.id ?? ''

  useEffect(() => {
    if (step.targets.length === 0) return

    function measure() {
      let found: Element | null = null
      for (const selector of step.targets) {
        const el = document.querySelector(selector.replace('{task}', taskId))
        if (el && (el as HTMLElement).offsetParent !== null) found = el
      }
      if (!found) {
        if (targetRef.current) {
          targetRef.current = null
          setHole(null)
        }
        return
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

    measure()
    const timer = setInterval(measure, POLL_MS)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, taskId])

  // --- the ends -----------------------------------------------------------

  function finish(outcome: 'keep' | 'clean') {
    if (sandbox) {
      endTour()
      exitTourSandbox()
      return
    }
    if (outcome === 'clean') actions.discardTourCreated()
    else actions.keepTourCreated()
    endTour()
  }

  function skip() {
    finish('keep')
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
        sandbox={sandbox}
        onStart={() => setTourStep(index + 1)}
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
  hole: Hole | null
  wide: boolean
  celebrating: boolean
  sandbox: boolean
  onStart: () => void
  onSkip: () => void
  onFinish: (outcome: 'keep' | 'clean') => void
}

function TourCard({ step, text, index, count, hole, wide, celebrating, sandbox, onStart, onSkip, onFinish }: TourCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(160)

  useLayoutEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight)
  }, [text, step.id, celebrating])

  // Beside the hole on a wide screen - below it when there is room, above it
  // otherwise, never over it. A phone gets the card along the bottom edge,
  // where a thumb is, and the hole wherever it is; the keyboard pushes the
  // whole viewport up and the card with it.
  let style: React.CSSProperties
  if (!wide || !hole) {
    style = wide
      ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: CARD_WIDTH }
      : { left: CARD_GAP, right: CARD_GAP, bottom: `calc(${CARD_GAP}px + env(safe-area-inset-bottom))` }
  } else {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = hole.y + hole.h + CARD_GAP + height <= vh
    const top = below ? hole.y + hole.h + CARD_GAP : Math.max(CARD_GAP, hole.y - CARD_GAP - height)
    const left = Math.min(Math.max(CARD_GAP, hole.x), vw - CARD_WIDTH - CARD_GAP)
    style = { left, top, width: CARD_WIDTH }
  }

  const isStart = step.event === 'start'
  const isFinish = step.event === 'finish'

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
      <p className="tour-text">{isFinish && sandbox ? 'This was a sandbox. Nothing here is kept.' : text}</p>
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
          {!isFinish && (
            <button type="button" className="tour-skip" onClick={onSkip}>
              Skip
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
