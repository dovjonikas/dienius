import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { parseNorth } from '../../lib/northSections'
import { readNorthFold, rememberNorthFold, type NorthFold } from '../../lib/northFold'
import { placeNorthCard } from './northCardPlacement'

/**
 * North beside the day, v2.28: a small "North" that folds, and the headings
 * as they were written, one line each. Never the picture and never the
 * signature.
 *
 * ## What of the text, and why only that
 *
 * The picture is read whole, once, after sleep - in the window that opens
 * then, and on the page - and a text read all day becomes wallpaper by the
 * end of a week, so the day never shows it. The day's top carries one line
 * of the text, and the signature in the evening (NorthLine). Here, beside the
 * day, the headings are an index: each is written the way it was typed, in
 * the small type on one line - a long one cut with an ellipsis, never wrapped
 * onto a second - and what it holds comes when asked: a small card of its
 * lines beside it, over the day, while the pointer rests on it, and the same
 * card on a press, which is how a finger asks. The card opens with the
 * heading written whole when the line had to cut it. The card is a layer:
 * nothing under it moves.
 *
 * ## Folded, with one press, and remembered here
 *
 * The word North is the fold: a press puts the headings away and another
 * brings them back, and this device remembers which (lib/northFold.ts). Where
 * nobody has chosen here the layout decides. In the rail North starts open -
 * unless the rail would not fit its window with it open, measured before
 * anything is drawn so nothing jumps: the month, the templates, what is next
 * and the day's numbers are the day itself, and North's headings are an
 * index to a page one press away, so North is what gives way. On a phone it
 * starts folded, a line under the day's top.
 *
 * ## Where
 *
 * In the rail, where there is a rail, between the templates and what is
 * next. Where there is no rail - a phone, a window too narrow for one - it
 * is one line under the day's top instead, the word North, and a press on it
 * opens the headings under it; a press on a heading opens its card under it.
 *
 * No card of its own, no edge and no ground: it is part of the page, not a
 * widget on it. The switch under Nudges takes it off the day, and only off
 * is carried in the plan - see `NorthSettings.stripOnDay`.
 */
export function NorthDay({ date, folded: narrow = false }: { date: string; folded?: boolean }) {
  const data = useAppData()
  const listId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  // What this device chose, or null for the layout's own default.
  const [chosen, setChosen] = useState<NorthFold | null>(() => readNorthFold())
  // The rail's default where nobody chose: whether the rail is too full for
  // its window with North open. Read once, before the first paint.
  const [railFull, setRailFull] = useState(false)
  const open = chosen !== null ? chosen === 'open' : !narrow && !railFull

  useLayoutEffect(() => {
    if (narrow || chosen !== null) return
    const rail = sectionRef.current?.closest('.rail')
    if (rail && rail.scrollHeight > rail.clientHeight + 1) setRailFull(true)
    // Once, on arriving: a rail that refolded itself as the plan changed
    // would be a section moving under somebody's hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    const next: NorthFold = open ? 'folded' : 'open'
    rememberNorthFold(next)
    setChosen(next)
  }

  if (data.settings.north.stripOnDay === false) return null
  const { sections } = parseNorth(data.picture?.text ?? '')

  const headings =
    sections.length > 0 ? (
      <ul id={listId} className="north-day-headings">
        {sections.map((section, i) => (
          <NorthDayHeading key={`${date}-${i}`} heading={section.heading} paragraphs={section.paragraphs} />
        ))}
      </ul>
    ) : null

  if (!headings) return null

  const fold = (
    <button
      type="button"
      className="north-day-line"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      onClick={toggle}
    >
      North
      <span className="north-day-caret" aria-hidden="true" />
    </button>
  )

  if (narrow) {
    return (
      <div className="north-day is-folded" role="group" aria-label="North">
        {fold}
        {open && headings}
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="north-day" aria-label="North">
      <h3 className="rail-heading north-day-label">{fold}</h3>
      {open && headings}
    </section>
  )
}

/**
 * One heading, and the card of its lines.
 *
 * A pointer resting on the heading shows the card and leaving takes it
 * away; a keyboard's focus does the same. A press shows it and keeps it -
 * a finger has nothing to rest - and a second press, a press anywhere else,
 * or Escape puts it away. A heading with nothing under it has no card and is
 * not a control.
 */
function NorthDayHeading({ heading, paragraphs }: { heading: string; paragraphs: string[] }) {
  // 'rest' while a pointer or the focus is on it, 'press' once it was pressed.
  const [shown, setShown] = useState<null | 'rest' | 'press'>(null)
  // Whether the line had to cut the heading short. Read as the card opens,
  // not on render: it is a fact about the layout, settled once the line is
  // on screen.
  const [cut, setCut] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const cardId = useId()

  function measure() {
    const el = ref.current
    setCut(!!el && el.scrollWidth > el.clientWidth + 1)
  }

  useEffect(() => {
    if (shown !== 'press') return
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setShown(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [shown])

  if (paragraphs.length === 0) {
    return (
      <li>
        <span className="north-day-heading is-bare">{heading}</span>
      </li>
    )
  }

  return (
    <li>
      <button
        ref={ref}
        type="button"
        className="north-day-heading"
        aria-expanded={shown !== null}
        aria-describedby={shown !== null ? cardId : undefined}
        onPointerEnter={e => {
          if (e.pointerType !== 'mouse') return
          measure()
          setShown(s => s ?? 'rest')
        }}
        onPointerLeave={e => e.pointerType === 'mouse' && setShown(s => (s === 'rest' ? null : s))}
        onFocus={() => {
          measure()
          setShown(s => s ?? 'rest')
        }}
        onBlur={() => setShown(s => (s === 'rest' ? null : s))}
        onClick={() => {
          measure()
          setShown(s => (s === 'press' ? null : 'press'))
        }}
        onKeyDown={e => {
          if (e.key === 'Escape' && shown !== null) {
            e.stopPropagation()
            setShown(null)
          }
        }}
      >
        {heading}
      </button>
      {shown !== null && (
        <NorthHeadingCard id={cardId} anchor={ref} heading={cut ? heading : undefined} paragraphs={paragraphs} />
      )}
    </li>
  )
}

/**
 * The card: a heading's lines on a layer beside the heading, or under it
 * where there is no room beside, opening with the heading written whole when
 * the line cut it short. Fixed to the window and out of the flow, so nothing
 * under it moves; the pointer never has to reach it, so it takes none of the
 * pointer's presses. Laid out hidden first, then placed, so it never shows in
 * the wrong place for a frame.
 */
function NorthHeadingCard({
  id,
  anchor,
  heading,
  paragraphs,
}: {
  id: string
  anchor: React.RefObject<HTMLButtonElement | null>
  heading?: string
  paragraphs: string[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const card = ref.current
    const heading = anchor.current
    if (!card || !heading) return
    function place() {
      const box = heading!.getBoundingClientRect()
      const inset = parseFloat(getComputedStyle(card!).paddingTop) - parseFloat(getComputedStyle(heading!).paddingTop)
      const at = placeNorthCard(
        { x: box.left, y: box.top, w: box.width, h: box.height },
        { w: card!.offsetWidth, h: card!.offsetHeight },
        { w: window.innerWidth, h: window.innerHeight },
        Number.isFinite(inset) ? inset : 0,
      )
      setSpot({ left: at.left, top: at.top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="north-heading-card"
      style={spot ? { left: `${spot.left}px`, top: `${spot.top}px` } : { visibility: 'hidden' }}
    >
      {heading !== undefined && <p className="north-heading-card-heading">{heading}</p>}
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="north-paragraph">
          {paragraph}
        </p>
      ))}
    </div>
  )
}
