import { expect, test } from 'vitest'
import { isNorthHeading, northLineKinds, parseNorth } from './northSections'

/**
 * A line in capitals is a heading, and everything under it up to the next
 * heading, or to a line of only ---, is its text - blank lines included,
 * which only part it into paragraphs. What comes before the first heading
 * is the introduction, and what comes after --- is the signature. Every line
 * here is a generic one: the app carries nobody's text and neither does
 * this file.
 */

// --- what a heading is ----------------------------------------------------------

test('a line in capitals is a heading, and a line with any lowercase letter in it is not', () => {
  expect(isNorthHeading('FIRST HEADING')).toBe(true)
  expect(isNorthHeading('First heading')).toBe(false)
  expect(isNorthHeading('first heading')).toBe(false)
  expect(isNorthHeading('NOT This')).toBe(false)
})

test('digits and punctuation are neither here nor there, and a line with no letter is not a heading', () => {
  expect(isNorthHeading('PLAN 2026')).toBe(true)
  expect(isNorthHeading('ONE, TWO - THREE.')).toBe(true)
  expect(isNorthHeading('2026')).toBe(false)
  expect(isNorthHeading('- - -')).toBe(false)
  expect(isNorthHeading('')).toBe(false)
  expect(isNorthHeading('   ')).toBe(false)
})

test('a capital with a diacritic is a capital', () => {
  expect(isNorthHeading('ŽODIS ČIA')).toBe(true)
  expect(isNorthHeading('Žodis čia')).toBe(false)
})

test('spaces around a line do not decide anything', () => {
  expect(isNorthHeading('  FIRST HEADING  ')).toBe(true)
})

// --- what a heading holds ------------------------------------------------------------

test('a heading holds everything under it up to the next heading', () => {
  expect(parseNorth('FIRST HEADING\na line under it\na second line under it\nSECOND HEADING\na line under it')).toEqual({
    intro: [],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: ['a line under it\na second line under it'] },
      { heading: 'SECOND HEADING', paragraphs: ['a line under it'] },
    ],
    signature: [],
  })
})

test('a blank line under a heading does not end it: the lines after it are the same heading, in a second paragraph', () => {
  expect(parseNorth('FIRST HEADING\na line under it\na second line under it\n\na line in the second paragraph')).toEqual({
    intro: [],
    sections: [
      {
        heading: 'FIRST HEADING',
        paragraphs: ['a line under it\na second line under it', 'a line in the second paragraph'],
      },
    ],
    signature: [],
  })
})

test('the lines before the first heading are the introduction, in paragraphs of their own', () => {
  expect(parseNorth('a line before any heading\na second line before it\n\na second paragraph before it\n\nFIRST HEADING\na line under it')).toEqual({
    intro: ['a line before any heading\na second line before it', 'a second paragraph before it'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
    signature: [],
  })
})

test('a text with no heading is all introduction, paragraph by paragraph, with no section', () => {
  expect(parseNorth('a first line\na second line\n\na third line')).toEqual({
    intro: ['a first line\na second line', 'a third line'],
    sections: [],
    signature: [],
  })
})

// --- blank lines ---------------------------------------------------------------------

test('several blank lines are one paragraph break, and a line of spaces is a blank line', () => {
  expect(parseNorth('a first line\n\n\n\na second line\n   \na third line')).toEqual({
    intro: ['a first line', 'a second line', 'a third line'],
    sections: [],
    signature: [],
  })
})

test('blank lines next to a heading make no empty paragraph on either side of it', () => {
  expect(parseNorth('a line before any heading\n\n\nFIRST HEADING\n\n\na line under it\n\n\nSECOND HEADING\n\n')).toEqual({
    intro: ['a line before any heading'],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: ['a line under it'] },
      { heading: 'SECOND HEADING', paragraphs: [] },
    ],
    signature: [],
  })
})

test('a heading with nothing under it, and a heading straight after a heading, hold no paragraphs', () => {
  expect(parseNorth('FIRST HEADING\nSECOND HEADING\na line under it')).toEqual({
    intro: [],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: [] },
      { heading: 'SECOND HEADING', paragraphs: ['a line under it'] },
    ],
    signature: [],
  })
})

test('lines are read trimmed, and an empty text is no introduction and no sections', () => {
  expect(parseNorth('  a line before any heading  \n  FIRST HEADING \n   a line under it  ')).toEqual({
    intro: ['a line before any heading'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
    signature: [],
  })
  expect(parseNorth('')).toEqual({ intro: [], sections: [], signature: [] })
  expect(parseNorth('\n  \n\n')).toEqual({ intro: [], sections: [], signature: [] })
})

// --- the signature -------------------------------------------------------------------

/**
 * A line of only three hyphens ends the headings, and everything after it is
 * the signature: shown whole, at the foot of the page, and never folded under
 * anything. A text without that line has no signature and reads exactly as
 * it did before the rule existed.
 */
test('a line of only --- ends the headings, and everything after it is the signature, in paragraphs', () => {
  expect(
    parseNorth('a line before any heading\n\nFIRST HEADING\na line under it\n---\na signature line\n\na second signature paragraph'),
  ).toEqual({
    intro: ['a line before any heading'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
    signature: ['a signature line', 'a second signature paragraph'],
  })
})

test('a line in capitals after --- is a line of the signature, not a heading', () => {
  expect(parseNorth('FIRST HEADING\na line under it\n\n---\nNOT A HEADING HERE\na signature line')).toEqual({
    intro: [],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
    signature: ['NOT A HEADING HERE\na signature line'],
  })
})

test('only a line of exactly three hyphens starts the signature, spaces around it aside', () => {
  expect(parseNorth('a first line\n-- -\n----\n---x\n  ---  \na signature line')).toEqual({
    intro: ['a first line\n-- -\n----\n---x'],
    sections: [],
    signature: ['a signature line'],
  })
})

test('a text without --- has no signature, and its introduction and headings are what they were', () => {
  expect(parseNorth('a line before any heading\n\nFIRST HEADING\na line under it\n\na second paragraph under it')).toEqual({
    intro: ['a line before any heading'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it', 'a second paragraph under it'] }],
    signature: [],
  })
})

test('--- with nothing after it is no signature, and a text that starts with --- is all signature', () => {
  expect(parseNorth('a first line\n---\n\n')).toEqual({ intro: ['a first line'], sections: [], signature: [] })
  expect(parseNorth('---\na signature line')).toEqual({ intro: [], sections: [], signature: ['a signature line'] })
})

test('a second --- inside the signature is a line of the signature', () => {
  expect(parseNorth('---\na signature line\n---\nanother signature line')).toEqual({
    intro: [],
    sections: [],
    signature: ['a signature line\n---\nanother signature line'],
  })
})

// --- what the field draws --------------------------------------------------------------

/**
 * While the text is typed, the field draws each line as what the page will
 * read it as - a heading, the signature's mark, or text - so the drawing and
 * the page never disagree: capitals after the mark are the signature's and
 * are not drawn as a heading.
 */
test('each line is read as a heading, the signature mark or text, by the same rule as the page', () => {
  expect(northLineKinds('a first line\nFIRST HEADING\na line under it\n\n  ---  \nNOT A HEADING HERE\n---')).toEqual([
    'text',
    'heading',
    'text',
    'text',
    'mark',
    'text',
    'text',
  ])
  expect(northLineKinds('')).toEqual(['text'])
})

/**
 * Reading is a lens and never a filter: whatever shape the text has, every
 * line in it that is not blank comes out exactly once, in the order it was
 * written. A parser that dropped the line after a blank one, or the line
 * before a heading, would still draw a page that looked plausible.
 */
test('every line that is not blank comes out once, in the order it was written, and only the mark goes', () => {
  const texts = [
    'a line before any heading\n\nFIRST HEADING\na line under it\n\n\na second paragraph under it\nSECOND HEADING\n\na line under it',
    'FIRST HEADING\n\n\nSECOND HEADING\na line under it\n\na line in the second paragraph\n',
    'a first line\n  \na second line\n\n\n\na third line',
    'a first line\n\nFIRST HEADING\na line under it\n---\n\na signature line\n\n---\nANOTHER SIGNATURE LINE',
  ]
  for (const text of texts) {
    const { intro, sections, signature } = parseNorth(text)
    const read = [...intro, ...sections.flatMap(s => [s.heading, ...s.paragraphs]), ...signature].flatMap(p => p.split('\n'))
    const written = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    const mark = written.indexOf('---')
    if (mark >= 0) written.splice(mark, 1)
    expect(read).toEqual(written)
  }
})
