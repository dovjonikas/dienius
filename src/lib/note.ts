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
