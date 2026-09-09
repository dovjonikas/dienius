/**
 * A note, read as an optional set of choices.
 *
 * The owner's case: a lunch block that carries three recipes, each of them
 * long. One note held all three, and the only way to read any of it was to
 * open the whole thing and scroll past the other two. What is wanted is to
 * see the three names and open one.
 *
 * That needs no new field and no new shape in the data. A note is still a
 * string. **A line beginning with `## ` starts a section**, and its heading
 * is a choice; everything above the first one is the intro. A note with no
 * such line is exactly what it always was, which is what makes this safe to
 * apply to every note ever written.
 *
 * **`## ` and nothing else.** Not a markdown subset, not a parser with an
 * escape hatch for the next thing somebody wants. A note is what a person
 * wrote for themselves, and a stray asterisk in a shopping list must not
 * silently become emphasis - the same reason `NoteLines` renders plain lines.
 * One rule is a rule somebody can hold in their head while typing.
 */

export interface NoteSection {
  /** The heading, without its `## `, at full length. */
  title: string
  /** Everything under it until the next heading, with its line breaks kept. */
  body: string
}

export interface ParsedNote {
  /** Everything before the first heading. The whole note when there is none. */
  intro: string
  sections: NoteSection[]
}

/**
 * How much of a heading a control shows.
 *
 * Cut at display, never in the data: what somebody typed is what is stored
 * and what a backup carries, and a title that came back shorter than it went
 * in would be this file editing their note.
 */
export const SECTION_TITLE_MAX = 64

/** A heading, at the length a button can show. */
export function sectionLabel(title: string): string {
  return title.length <= SECTION_TITLE_MAX ? title : `${title.slice(0, SECTION_TITLE_MAX - 1).trimEnd()}…`
}

/**
 * Blank lines off the top and bottom, and nothing else.
 *
 * Not `trim()`: a line that begins with spaces is drawn fixed-width - see
 * `NoteLines` - so trimming the joined text would take the indent off the
 * first line of every section and quietly change how it reads.
 */
function trimBlankEdges(lines: string[]): string {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === '') start += 1
  while (end > start && lines[end - 1].trim() === '') end -= 1
  return lines.slice(start, end).join('\n')
}

export function parseNote(note: string | undefined): ParsedNote {
  if (!note) return { intro: '', sections: [] }
  // Every line ending anybody's keyboard or clipboard produces. A note
  // pasted from another machine is still one note.
  const lines = note.split(/\r\n|\r|\n/)
  const sections: NoteSection[] = []
  const intro: string[] = []
  let open: { title: string; lines: string[] } | null = null

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (open) sections.push({ title: open.title, body: trimBlankEdges(open.lines) })
      open = { title: line.slice(3).trim(), lines: [] }
      continue
    }
    if (open) open.lines.push(line)
    else intro.push(line)
  }
  // A heading with nothing under it is still a choice somebody made, and it
  // stays - with an empty body rather than being dropped for being empty.
  if (open) sections.push({ title: open.title, body: trimBlankEdges(open.lines) })

  return { intro: trimBlankEdges(intro), sections }
}

/**
 * Where a `## ` heading goes when a button writes it, and where the caret
 * lands after.
 *
 * The rule is one somebody can hold in their head, but only once they know
 * it is there - so the editor carries a button that writes it, and this is
 * the half of that button worth a test. A heading starts its own line with a
 * blank one above it, the way a person leaving room would type it.
 *
 * What it refuses to do is stack another blank line onto text that already
 * ends in one. Pressing the button twice on an empty tail would otherwise
 * walk the note down the page a line at a time, and the second press would
 * look like it had done something different from the first.
 *
 * The caret is left after the space, so the next thing typed is the heading.
 * Whatever followed the caret is now under it, which is what makes this work
 * for a line already written: put the caret at its start and it becomes a
 * choice.
 */
export function insertSectionHeading(text: string, at: number): { text: string; caret: number } {
  const cut = Math.max(0, Math.min(at, text.length))
  const before = text.slice(0, cut)
  const after = text.slice(cut)
  // A press with the caret already in a heading nobody has typed into has
  // nothing to add - the choice it offers to start is started. Without this
  // a second press leaves a second empty heading, and an empty heading is a
  // choice on the card: a mark somebody then has to go back and delete.
  if (/(?:^|\n)## *$/.test(before) && (after === '' || after.startsWith('\n'))) return { text, caret: cut }
  // At the very top there is nothing to be separated from.
  const already = before === '' ? 2 : (before.match(/\n*$/)?.[0].length ?? 0)
  const head = `${'\n'.repeat(Math.max(0, 2 - already))}## `
  return { text: `${before}${head}${after}`, caret: before.length + head.length }
}
