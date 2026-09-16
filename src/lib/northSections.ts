/**
 * North's text, read for display: which lines are headings, and what each
 * heading holds.
 *
 * The rule is the owner's and has no control behind it: a line written in
 * capitals is a heading, and the lines under it, up to the next blank line
 * or the next heading, are its text. Nothing else is markup. There is no
 * button for bold, no syntax to learn and nothing to get wrong - typing in
 * capitals is the formatting, and a text with no capitals-only line in it
 * has no headings and reads exactly as it did before this existed.
 *
 * Only the reading side knows any of this. The text is stored as the one
 * string the person typed, blank lines and all, and is parsed here every
 * time it is drawn; nothing about headings is ever written back. So a
 * backup, an export and a sync carry the words and nothing the app made
 * of them, and changing this rule later changes what is shown, never what
 * is kept.
 *
 * What comes out is a list of parts in the order they were written. A
 * `lines` part is free text - a block before the first heading, or after
 * the blank line that ended a section - and is always shown. A `section`
 * is a heading with the lines under it, shown on demand. Two blank lines
 * are one gap, as the page has always drawn them.
 */
export type NorthPart =
  | { kind: 'lines'; lines: string[] }
  | { kind: 'section'; heading: string; lines: string[] }

/**
 * Whether a line is a heading: it has at least one letter, and every letter
 * in it is a capital. Digits and punctuation are neither here nor there,
 * so "PLAN 2026" is a heading and "2026" is not; and a lowercase letter
 * anywhere means an ordinary line, so "Not THIS" is text. Compared through
 * the string's own case mapping, so a capital with a diacritic counts the
 * same as a plain one.
 */
export function isNorthHeading(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  return t === t.toUpperCase() && t !== t.toLowerCase()
}

/** The text as parts, in order. An empty text is no parts at all. */
export function parseNorth(text: string): NorthPart[] {
  const parts: NorthPart[] = []
  let current: NorthPart | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      // A blank line ends whatever was open - a section's text or a free
      // block - and the next line starts afresh.
      current = null
      continue
    }
    if (isNorthHeading(line)) {
      current = { kind: 'section', heading: line, lines: [] }
      parts.push(current)
      continue
    }
    if (!current) {
      current = { kind: 'lines', lines: [] }
      parts.push(current)
    }
    current.lines.push(line)
  }
  return parts
}

/** Whether the text has a heading at all - without one, it reads as plain blocks. */
export function hasNorthHeadings(text: string): boolean {
  return text.split('\n').some(isNorthHeading)
}
