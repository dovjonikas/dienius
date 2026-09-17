/**
 * The capitals rule: how a text somebody typed is read into headings, once,
 * for every text in the app that has them - North's since v2.23 and a
 * recipe's since v2.27.
 *
 * The rule has no control behind it: a line written in capitals is a
 * heading, and everything under it up to the next heading is its text. A
 * blank line does not end a heading. It parts the text under it into
 * paragraphs, which is what a blank line means in anything a person writes,
 * and the heading still owns the paragraph after it. The lines before the
 * first heading are the introduction. There is no button for bold, no syntax
 * to learn and nothing to get wrong - typing in capitals is the formatting,
 * and a text with no capitals-only line in it has no headings at all.
 *
 * A kind of text may add to the rule, and only by passing it in: North adds
 * a signature after a line of `---` and two words a heading may end on
 * (lib/northSections.ts); a recipe adds nothing here, and reads two of its
 * headings as a list and as steps on top (lib/recipeText.ts). So North and
 * Kitchen can never disagree about what a heading is: there is one function
 * that decides it.
 *
 * Only the reading side knows any of this. A text is stored as the one
 * string typed and parsed every time it is drawn, so a backup carries the
 * words and nothing the app made of them.
 */

/** What a kind of text adds to the capitals rule. Nothing, unless said. */
export interface HeadingRules {
  /**
   * A tag a heading may end on, read and taken off the heading: a pattern
   * anchored at the end of the line whose first group, lowercased, is the
   * tag. A heading is judged on its words without it.
   */
  tag?: RegExp
  /**
   * Whether a line of three hyphens and nothing else ends the headings and
   * starts a signature, after which nothing is a heading.
   */
  signature?: boolean
}

/** One heading and everything under it, to the next heading or the signature. */
export interface HeadedSection {
  /** The heading as it is shown: the line, trimmed, without its tag. */
  heading: string
  /** The tag the heading's line ended on, when the rules read tags and it ended on one. */
  tag?: string
  /**
   * The text under the heading in paragraphs, each one its lines joined by a
   * line break. Several blank lines are one break, and a heading with
   * nothing under it has none.
   */
  paragraphs: string[]
}

/** A text as it reads: the introduction, the headings in order, and the signature. */
export interface HeadedText {
  /** The paragraphs before the first heading. A text with no heading is all introduction. */
  intro: string[]
  sections: HeadedSection[]
  /** The paragraphs after the line of `---`, when the rules have a signature. */
  signature: string[]
}

/** What a line is read as, for a field that draws each line while it is typed. */
export type HeadedLineKind = 'heading' | 'mark' | 'text'

/**
 * A line taken apart into its words and the tag it ends on, if the rules
 * read tags and it ends on one. The words are trimmed; a line that is only a
 * tag has no words.
 */
export function splitHeading(line: string, rules: HeadingRules = {}): { heading: string; tag?: string } {
  const t = line.trim()
  const found = rules.tag ? rules.tag.exec(t) : null
  if (!found) return { heading: t }
  return { heading: t.slice(0, found.index).trim(), tag: found[1].toLowerCase() }
}

/**
 * Whether a line is a heading: it has at least one letter, and every letter
 * in it is a capital. Digits and punctuation are neither here nor there, so
 * "PLAN 2026" is a heading and "2026" is not; and a lowercase letter anywhere
 * means an ordinary line, so "Not THIS" is text. Compared through the
 * string's own case mapping, so a capital with a diacritic counts the same
 * as a plain one. A tag the rules read is not part of the question, and a
 * line that is only a tag is text.
 */
export function isHeading(line: string, rules: HeadingRules = {}): boolean {
  const t = splitHeading(line, rules).heading
  if (!t) return false
  return t === t.toUpperCase() && t !== t.toLowerCase()
}

/**
 * Where a heading's tag starts in the line as it was typed, the spaces
 * before it included, or -1 when the rules read no tags, the line is not a
 * heading or it ends on no tag. Counted in the line untrimmed, for a field
 * that draws the tag apart from the words.
 */
export function tagAt(line: string, rules: HeadingRules = {}): number {
  if (!rules.tag || !isHeading(line, rules)) return -1
  return line.search(rules.tag)
}

/**
 * Whether a line is the one that starts a signature: three hyphens and
 * nothing else, spaces around it aside. Four hyphens, or three with a word
 * after them, are text. Only read where the rules have a signature.
 */
export function isSignatureMark(line: string): boolean {
  return line.trim() === '---'
}

/**
 * A text as its introduction, its headings and its signature. Lines are read
 * trimmed, and a line of spaces is a blank line.
 *
 * Paragraphs are gathered line by line and closed by a blank line, by a
 * heading, by the signature's mark or by the end of the text - so a blank
 * line beside a heading, or two blank lines in a row, close nothing that is
 * open and make no empty paragraph.
 */
export function parseHeadings(text: string, rules: HeadingRules = {}): HeadedText {
  const intro: string[] = []
  const sections: HeadedSection[] = []
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
    } else if (rules.signature && !signing && isSignatureMark(line)) {
      closeParagraph()
      signing = true
      paragraphs = signature
    } else if (!signing && isHeading(line, rules)) {
      closeParagraph()
      const { heading, tag } = splitHeading(line, rules)
      const section: HeadedSection = tag ? { heading, tag, paragraphs: [] } : { heading, paragraphs: [] }
      sections.push(section)
      paragraphs = section.paragraphs
    } else {
      lines.push(line)
    }
  }
  closeParagraph()
  return { intro, sections, signature }
}

/**
 * The introduction as it was typed: its lines, each read trimmed, with every
 * blank line between them kept and the blank lines at its two ends dropped.
 * `parseHeadings` gathers the same lines into paragraphs, where several blank
 * lines are one break; a page that keeps the person's own spacing reads this
 * instead. It ends where the paragraphs do, at the first heading or at the
 * signature's mark when the rules have one.
 */
export function introText(text: string, rules: HeadingRules = {}): string {
  const lines: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (rules.signature && isSignatureMark(line)) break
    if (isHeading(line, rules)) break
    lines.push(line)
  }
  return lines.join('\n').replace(/^\n+|\n+$/g, '')
}

/**
 * Every line of a text, in order, as `parseHeadings` will read it: a heading,
 * the signature's mark, or text. A field draws each line by this while it is
 * typed, so it is the same rule and not a second reading of capitals - after
 * the mark, capitals are the signature's.
 */
export function headingLineKinds(text: string, rules: HeadingRules = {}): HeadedLineKind[] {
  let signing = false
  return text.split('\n').map(line => {
    if (signing) return 'text'
    if (rules.signature && isSignatureMark(line)) {
      signing = true
      return 'mark'
    }
    return isHeading(line, rules) ? 'heading' : 'text'
  })
}
