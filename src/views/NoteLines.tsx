/**
 * A note, as the lines somebody typed.
 *
 * No markdown engine, deliberately. A note here is a recipe, four things to
 * pack, the weight to start the set at - text a person wrote for themselves,
 * and running it through a parser means a stray asterisk silently becomes
 * emphasis and a line beginning with a hash becomes a heading. What text like
 * that actually needs is for its line breaks to survive, which is the whole
 * of this.
 *
 * The one thing it does read is leading whitespace: a line that starts
 * indented is drawn in a monospace face, so a step list or a set of
 * quantities lines up in columns the way it was typed. That is a rule about
 * shape rather than about meaning, and it cannot turn one character into
 * formatting somebody did not ask for.
 */
export function NoteLines({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className ? `note-lines ${className}` : 'note-lines'}>
      {lines.map((line, i) => (
        <p
          // The line's position is its identity: two identical lines in a
          // note are two lines, and nothing here reorders them.
          key={i}
          className={/^\s+\S/.test(line) ? 'note-line is-fixed' : 'note-line'}
        >
          {/* An empty line is a blank line somebody left, and an empty <p>
              collapses to nothing. The space holds it open. */}
          {line.trim() === '' ? ' ' : line}
        </p>
      ))}
    </div>
  )
}
