import { expect, test } from 'vitest'
import { isNorthHeading, parseNorth } from './northSections'

/**
 * A line in capitals is a heading, and everything under it up to the next
 * heading is its text - blank lines included, which only part it into
 * paragraphs. What comes before the first heading is the introduction and
 * is always shown. Every line here is a generic one: the app carries
 * nobody's text and neither does this file.
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
  })
})

test('the lines before the first heading are the introduction, in paragraphs of their own', () => {
  expect(parseNorth('a line before any heading\na second line before it\n\na second paragraph before it\n\nFIRST HEADING\na line under it')).toEqual({
    intro: ['a line before any heading\na second line before it', 'a second paragraph before it'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
  })
})

test('a text with no heading is all introduction, paragraph by paragraph, with no section', () => {
  expect(parseNorth('a first line\na second line\n\na third line')).toEqual({
    intro: ['a first line\na second line', 'a third line'],
    sections: [],
  })
})

// --- blank lines ---------------------------------------------------------------------

test('several blank lines are one paragraph break, and a line of spaces is a blank line', () => {
  expect(parseNorth('a first line\n\n\n\na second line\n   \na third line')).toEqual({
    intro: ['a first line', 'a second line', 'a third line'],
    sections: [],
  })
})

test('blank lines next to a heading make no empty paragraph on either side of it', () => {
  expect(parseNorth('a line before any heading\n\n\nFIRST HEADING\n\n\na line under it\n\n\nSECOND HEADING\n\n')).toEqual({
    intro: ['a line before any heading'],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: ['a line under it'] },
      { heading: 'SECOND HEADING', paragraphs: [] },
    ],
  })
})

test('a heading with nothing under it, and a heading straight after a heading, hold no paragraphs', () => {
  expect(parseNorth('FIRST HEADING\nSECOND HEADING\na line under it')).toEqual({
    intro: [],
    sections: [
      { heading: 'FIRST HEADING', paragraphs: [] },
      { heading: 'SECOND HEADING', paragraphs: ['a line under it'] },
    ],
  })
})

test('lines are read trimmed, and an empty text is no introduction and no sections', () => {
  expect(parseNorth('  a line before any heading  \n  FIRST HEADING \n   a line under it  ')).toEqual({
    intro: ['a line before any heading'],
    sections: [{ heading: 'FIRST HEADING', paragraphs: ['a line under it'] }],
  })
  expect(parseNorth('')).toEqual({ intro: [], sections: [] })
  expect(parseNorth('\n  \n\n')).toEqual({ intro: [], sections: [] })
})

/**
 * Reading is a lens and never a filter: whatever shape the text has, every
 * line in it that is not blank comes out exactly once, in the order it was
 * written. A parser that dropped the line after a blank one, or the line
 * before a heading, would still draw a page that looked plausible.
 */
test('every line that is not blank comes out once, in the order it was written', () => {
  const texts = [
    'a line before any heading\n\nFIRST HEADING\na line under it\n\n\na second paragraph under it\nSECOND HEADING\n\na line under it',
    'FIRST HEADING\n\n\nSECOND HEADING\na line under it\n\na line in the second paragraph\n',
    'a first line\n  \na second line\n\n\n\na third line',
  ]
  for (const text of texts) {
    const { intro, sections } = parseNorth(text)
    const read = [...intro, ...sections.flatMap(s => [s.heading, ...s.paragraphs])].flatMap(p => p.split('\n'))
    const written = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    expect(read).toEqual(written)
  }
})
