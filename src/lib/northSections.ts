/**
 * North's text, read for display: which lines are headings, and what each
 * heading holds.
 *
 * The rule is the owner's and has no control behind it: a line written in
 * capitals is a heading, and everything under it up to the next heading is
 * its text. A blank line does not end a heading. It parts the text under it
 * into paragraphs, which is what a blank line means in anything a person
 * writes, and the heading still owns the paragraph after it. There is no
 * button for bold, no syntax to learn and nothing to get wrong - typing in
 * capitals is the formatting, and a text with no capitals-only line in it
 * has no headings at all.
 *
 * One more line means something, and only one: a line of three hyphens and
 * nothing else ends the headings, and everything after it is the signature -
 * the words a letter ends on, shown whole at the foot of the page and never
 * folded under a heading. After it nothing is a heading, capitals or not, and
 * a second such line is a line of the signature. It is the one piece of
 * syntax, and it is the one a person already writes above a signature.
 *
 * Until v2.24 a blank line ended a heading, and whatever followed it was
 * free text shown beside the headings. That made a second paragraph under a
 * heading impossible to write: the moment one was typed it fell out of the
 * heading and onto the page. The owner's correction was that a heading rules
 * to the next heading, so the free text a section could leave behind is gone
 * from the shape as well - the only lines outside a heading are the ones
 * before the first, which is the introduction, and the ones after the
 * signature's mark.
 *
 * Only the reading side knows any of this. The text is stored as the one
 * string the person typed, blank lines and all, and is parsed here every
 * time it is drawn; nothing about headings is ever written back. So a
 * backup, an export and a sync carry the words and nothing the app made of
 * them, and changing this rule later changes what is shown, never what is
 * kept.
 */

/** One heading and everything under it, to the next heading or the signature. */
export interface NorthSection {
  heading: string
  /**
   * The text under the heading in paragraphs, each one its lines joined by
   * a line break. Several blank lines are one break, and a heading with
   * nothing under it has none.
   */
  paragraphs: string[]
}

/** The text as it reads: the introduction, the headings in order, and the signature. */
export interface NorthReading {
  /**
   * The paragraphs before the first heading, always shown. A text with no
   * heading is all introduction, which is how it reads the whole text as it
   * was written.
   */
  intro: string[]
  sections: NorthSection[]
  /**
   * The paragraphs after the line of `---`, always shown, at the foot. A
   * text without that line has none.
   */
  signature: string[]
}

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

/**
 * Whether a line is the one that starts the signature: three hyphens and
 * nothing else, spaces around it aside. Four hyphens, or three with a word
 * after them, are text.
 */
export function isNorthSignatureMark(line: string): boolean {
  return line.trim() === '---'
}

/**
 * The text as an introduction, its headings and its signature. Lines are
 * read trimmed, and a line of spaces is a blank line.
 *
 * Paragraphs are gathered line by line and closed by a blank line, by a
 * heading, or by the end of the text - so a blank line beside a heading, or
 * two blank lines in a row, close nothing that is open and make no empty
 * paragraph.
 */
export function parseNorth(text: string): NorthReading {
  const intro: string[] = []
  const sections: NorthSection[] = []
  const signature: string[] = []
  let paragraphs = intro
  let lines: string[] = []
  let signing = false

  function closeParagraph() {
    if (lines.length === 0) return
    paragraphs.push(lines.join('\n'))
    lines = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      closeParagraph()
    } else if (!signing && isNorthSignatureMark(line)) {
      closeParagraph()
      signing = true
      paragraphs = signature
    } else if (!signing && isNorthHeading(line)) {
      closeParagraph()
      const section: NorthSection = { heading: line, paragraphs: [] }
      sections.push(section)
      paragraphs = section.paragraphs
    } else {
      lines.push(line)
    }
  }
  closeParagraph()
  return { intro, sections, signature }
}

/** What a line of the text is read as - see `northLineKinds`. */
export type NorthLineKind = 'heading' | 'mark' | 'text'

/**
 * Every line of the text, in order, as the page will read it: a heading, the
 * signature's mark, or text. The field draws each line by this while it is
 * typed, so it is the same rule as `parseNorth` and not a second reading of
 * capitals - after the mark, capitals are the signature's.
 */
export function northLineKinds(text: string): NorthLineKind[] {
  let signing = false
  return text.split('\n').map(line => {
    if (signing) return 'text'
    if (isNorthSignatureMark(line)) {
      signing = true
      return 'mark'
    }
    return isNorthHeading(line) ? 'heading' : 'text'
  })
}
