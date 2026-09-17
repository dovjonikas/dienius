import {
  headingLineKinds,
  isHeading,
  isSignatureMark,
  parseHeadings,
  splitHeading,
  tagAt,
  type HeadedLineKind,
  type HeadingRules,
} from './headings'

/**
 * North's text, read for display: which lines are headings, what each
 * heading holds, and the signature.
 *
 * The capitals rule is the owner's and is not North's alone: a line written
 * in capitals is a heading, and everything under it up to the next heading
 * is its text, blank lines and all. Since v2.27 it lives in lib/headings.ts,
 * where a recipe reads by the same function - this module is what North adds
 * to it, and the names North's screens have always called.
 *
 * One more line means something to North, and only one: a line of three
 * hyphens and nothing else ends the headings, and everything after it is the
 * signature - the words a letter ends on, shown whole at the foot of the page
 * and never folded under a heading. After it nothing is a heading, capitals
 * or not, and a second such line is a line of the signature. It is the one
 * piece of syntax, and it is the one a person already writes above a
 * signature.
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

/**
 * The two words a heading may end on, in square brackets, to say when its
 * lines belong on the day: `[morning]` for the first hours after waking and
 * `[evening]` for the end of the day - lib/northLine.ts has the rule. Read,
 * and never shown: the day, the rail, the page and the window all show the
 * heading without it, and only the field the text is written in holds it.
 */
export type NorthTag = 'morning' | 'evening'

/** A tag at the very end of a line, in either case, spaces around it aside. */
const NORTH_TAG = /\s*\[(morning|evening)\]\s*$/i

/** What North adds to the capitals rule: its two tags and its signature. */
export const NORTH_RULES: HeadingRules = { tag: NORTH_TAG, signature: true }

/** One heading and everything under it, to the next heading or the signature. */
export interface NorthSection {
  /** The heading as it is shown: the line, trimmed, without its tag. */
  heading: string
  /** The tag the heading's line ended on, when it ended on one. */
  tag?: NorthTag
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
 * A line taken apart into its words and the tag it ends on, if it ends on
 * one. The words are trimmed; a line that is only a tag has no words.
 */
export function splitNorthHeading(line: string): { heading: string; tag?: NorthTag } {
  return splitHeading(line, NORTH_RULES) as { heading: string; tag?: NorthTag }
}

/**
 * Where a heading's tag starts in the line as it was typed, the spaces
 * before it included, or -1 when the line is not a heading or ends on no
 * tag. The field draws the tag apart from the heading's words by it, so it
 * counts in the line untrimmed.
 */
export function northTagAt(line: string): number {
  return tagAt(line, NORTH_RULES)
}

/**
 * Whether a line is a heading - lib/headings.ts has the rule. A tag at the
 * end is not part of the question - "A HEADING [morning]" is a heading, in
 * capitals, that ends on a tag - and a line that is only a tag is text.
 */
export function isNorthHeading(line: string): boolean {
  return isHeading(line, NORTH_RULES)
}

/**
 * Whether a line is the one that starts the signature: three hyphens and
 * nothing else, spaces around it aside. Four hyphens, or three with a word
 * after them, are text.
 */
export function isNorthSignatureMark(line: string): boolean {
  return isSignatureMark(line)
}

/**
 * The text as an introduction, its headings and its signature, by the
 * shared parser with North's rules.
 */
export function parseNorth(text: string): NorthReading {
  return parseHeadings(text, NORTH_RULES) as NorthReading
}

/** What a line of the text is read as - see `northLineKinds`. */
export type NorthLineKind = HeadedLineKind

/**
 * Every line of the text, in order, as the page will read it: a heading, the
 * signature's mark, or text. The field draws each line by this while it is
 * typed, so it is the same rule as `parseNorth` and not a second reading of
 * capitals - after the mark, capitals are the signature's.
 */
export function northLineKinds(text: string): NorthLineKind[] {
  return headingLineKinds(text, NORTH_RULES)
}
