/**
 * One heading and everything it holds, read.
 *
 * Since v2.26 North's page is for reading, and everything on it is open: a
 * heading stands over its lines the way it was written, and nothing folds
 * away behind a press or a pointer. The day beside it is where a heading's
 * lines come when asked (NorthDay); the page is where they are read whole.
 * The heading is words, not a control.
 */
export function NorthSection({ heading, paragraphs }: { heading: string; paragraphs: string[] }) {
  return (
    <section className="north-section">
      <h3 className="north-heading">{heading}</h3>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="north-paragraph">
          {paragraph}
        </p>
      ))}
    </section>
  )
}
