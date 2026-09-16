import { useId, useState } from 'react'

/**
 * One heading and everything it holds.
 *
 * At rest only the heading shows. What is under it comes when asked, in two
 * ways, and the state here is the same for both:
 *
 * - **A pointer resting on the heading** lays the words out under it, over
 *   the page, and everything after the heading steps back to nothing while
 *   they are read. Nothing is moved to make the room - CONVENTIONS 24 - so
 *   the words unfold where the next headings were and fold away when the
 *   pointer leaves, and the next heading is under the pointer the moment it
 *   moves down to it. That is the stylesheet's, on a pointer that can rest.
 * - **A press** opens the words in the page, on any device, and a second
 *   press closes them. On a phone it is the only way, and on a desktop it is
 *   how words longer than a glance stay open to be read. A press may move
 *   the page where a pointer may not.
 *
 * A keyboard reaches the heading, which shows its words the way a resting
 * pointer does, and opens it the way a press does; Escape closes it.
 *
 * A press that closes a heading leaves the pointer on it, and the hover would
 * lay the same words straight back over the page - the press would seem to
 * have done nothing. So a closed heading is quiet until the pointer or the
 * focus leaves it, and only a heading that is neither open nor quiet offers
 * its words to the hover (`can-preview`).
 *
 * A heading with nothing under it is a heading and not a control: there is
 * nothing to open, so nothing offers to.
 */
export function NorthSection({ heading, paragraphs }: { heading: string; paragraphs: string[] }) {
  const [open, setOpen] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const id = useId()
  if (paragraphs.length === 0) {
    return (
      <section className="north-section is-bare">
        <h3 className="north-heading">{heading}</h3>
      </section>
    )
  }
  const className = open ? 'north-section is-open' : quiet ? 'north-section' : 'north-section can-preview'
  return (
    <section
      className={className}
      onPointerLeave={() => setQuiet(false)}
      onKeyDown={e => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <h3 className="north-heading">
        <button
          type="button"
          className="north-heading-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (open) setQuiet(true)
            setOpen(!open)
          }}
          onBlur={() => setQuiet(false)}
        >
          {heading}
        </button>
      </h3>
      <div id={id} className="north-section-body">
        <div className="north-section-text">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="north-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
