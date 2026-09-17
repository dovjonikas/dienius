import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useAppData } from '../../lib/store'
import { parseNorth } from '../../lib/northSections'
import { placeNorthCard } from './northCardPlacement'

/**
 * North beside the day: a small "North", the headings as they were written,
 * and the signature under them. Never the introduction.
 *
 * ## What of the text, and why only that
 *
 * The introduction is read whole, once, after sleep - in the window that
 * opens then, and on the page - and a text read all day becomes wallpaper by
 * the end of a week, so the day never shows it. The day's top carries one
 * line of the text and the signature (NorthLine). Here, beside the day, the
 * headings are an index: each is written the way it was typed, in the rail's
 * reading ink, not tracked small like a menu, and what it holds comes when
 * asked - a small card of its lines beside it, over the day, while the
 * pointer rests on it, and the same card on a press, which is how a finger
 * asks. The card is a layer: nothing under it moves. The signature closes
 * the section the way it closes the page.
 *
 * ## Where
 *
 * In the rail, where there is a rail: the rail is the day's narrow column of
 * context - the month, the templates, what is next and the day's numbers -
 * and North stands between the templates and what is next, so that a 768px
 * window shows it without the rail being scrolled.
 *
 * Where there is no rail - a phone, a window too narrow for one - it is one
 * line under the day's top instead, the word North, and a press on it opens
 * the headings under it; a press on a heading opens its card under it. The
 * signature is the day's own line's to say there.
 *
 * No card of its own, no edge and no ground: it is part of the page, not a
 * widget on it. The switch under Nudges takes it off the day, and only off
 * is carried in the plan - see `NorthSettings.stripOnDay`.
 */
export function NorthDay({ date, folded = false }: { date: string; folded?: boolean }) {
  const data = useAppData()
  const [open, setOpen] = useState(false)
  const listId = useId()

  // Folded again whenever the day changes underneath it, and every heading's
  // card with it - the headings are keyed by the date below.
  useEffect(() => {
    setOpen(false)
  }, [date])

  if (data.settings.north.stripOnDay === false) return null
  const { sections, signature } = parseNorth(data.picture?.text ?? '')

  const headings =
    sections.length > 0 ? (
      <ul id={listId} className="north-day-headings">
        {sections.map((section, i) => (
          <NorthDayHeading key={`${date}-${i}`} heading={section.heading} paragraphs={section.paragraphs} />
        ))}
      </ul>
    ) : null

  if (folded) {
    if (!headings) return null
    return (
      <div className="north-day is-folded" role="group" aria-label="North">
        <button
          type="button"
          className="north-day-line"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen(o => !o)}
        >
          North
        </button>
        {open && headings}
      </div>
    )
  }

  if (sections.length === 0 && signature.length === 0) return null
  return (
    <section className="north-day" aria-label="North">
      <h3 className="rail-heading north-day-label">North</h3>
      {headings}
      {signature.length > 0 && (
        <div className="north-day-signature">
          {signature.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      )}
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
  const ref = useRef<HTMLButtonElement>(null)
  const cardId = useId()

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
        onPointerEnter={e => e.pointerType === 'mouse' && setShown(s => s ?? 'rest')}
        onPointerLeave={e => e.pointerType === 'mouse' && setShown(s => (s === 'rest' ? null : s))}
        onFocus={() => setShown(s => s ?? 'rest')}
        onBlur={() => setShown(s => (s === 'rest' ? null : s))}
        onClick={() => setShown(s => (s === 'press' ? null : 'press'))}
        onKeyDown={e => {
          if (e.key === 'Escape' && shown !== null) {
            e.stopPropagation()
            setShown(null)
          }
        }}
      >
        {heading}
      </button>
      {shown !== null && <NorthHeadingCard id={cardId} anchor={ref} paragraphs={paragraphs} />}
    </li>
  )
}

/**
 * The card: a heading's lines on a layer beside the heading, or under it
 * where there is no room beside. Fixed to the window and out of the flow, so
 * nothing under it moves; the pointer never has to reach it, so it takes
 * none of the pointer's presses. Laid out hidden first, then placed, so it
 * never shows in the wrong place for a frame.
 */
function NorthHeadingCard({
  id,
  anchor,
  paragraphs,
}: {
  id: string
  anchor: React.RefObject<HTMLButtonElement | null>
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
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="north-paragraph">
          {paragraph}
        </p>
      ))}
    </div>
  )
}
