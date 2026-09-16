/**
 * North's text, read for display: which lines are headings, and what each
 * heading holds.
 *
 * The rule is the owner's and has no control behind it: a line written in
 * capitals is a heading, and everything under it up to the next heading is
 * its text. A blank line does not end a heading. It parts the text under it
 * into paragraphs, which is what a blank line means in anything a person
 * writes, and the heading still owns the paragraph after it. Nothing else is
 * markup. There is no button for bold, no syntax to learn and nothing to get
 * wrong - typing in capitals is the formatting, and a text with no
 * capitals-only line in it has no headings at all.
 *
 * Until v2.24 a blank line ended a heading, and whatever followed it was
 * free text shown beside the headings. That made a second paragraph under a
 * heading impossible to write: the moment one was typed it fell out of the
 * heading and onto the page. The owner's correction was that a heading rules
 * to the next heading, so the free text a section could leave behind is gone
 * from the shape as well - the only lines outside a heading are the ones
 * before the first, which is the introduction.
 *
 * Only the reading side knows any of this. The text is stored as the one
 * string the person typed, blank lines and all, and is parsed here every
 * time it is drawn; nothing about headings is ever written back. So a
 * backup, an export and a sync carry the words and nothing the app made of
 * them, and changing this rule later changes what is shown, never what is
 * kept.
 */

/** One heading and everything under it, to the next heading. */
export interface NorthSection {
  heading: string
  /**
   * The text under the heading in paragraphs, each one its lines joined by
   * a line break. Several blank lines are one break, and a heading with
   * nothing under it has none.
   */
  paragraphs: string[]
}

/** The text as it reads: the introduction, then the headings in order. */
export interface NorthReading {
  /**
   * The paragraphs before the first heading, always shown. A text with no
   * heading is all introduction, which is how it reads the whole text as it
   * was written.
   */
  intro: string[]
  sections: NorthSection[]
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
 * The text as an introduction and its headings. Lines are read trimmed, and
 * a line of spaces is a blank line.
 *
 * Paragraphs are gathered line by line and closed by a blank line, by a
 * heading, or by the end of the text - so a blank line beside a heading, or
 * two blank lines in a row, close nothing that is open and make no empty
 * paragraph.
 */
export function parseNorth(text: string): NorthReading {
  const intro: string[] = []
  const sections: NorthSection[] = []
  let paragraphs = intro
  let lines: string[] = []

  function closeParagraph() {
    if (lines.length === 0) return
    paragraphs.push(lines.join('\n'))
    lines = []
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      closeParagraph()
    } else if (isNorthHeading(line)) {
      closeParagraph()
      const section: NorthSection = { heading: line, paragraphs: [] }
      sections.push(section)
      paragraphs = section.paragraphs
    } else {
      lines.push(line)
    }
  }
  closeParagraph()
  return { intro, sections }
}
