import { expect, test } from 'vitest'
import { hasNorthHeadings, isNorthHeading, parseNorth } from './northSections'

/**
 * A line in capitals is a heading; the lines under it, up to a blank line
 * or the next heading, are its text. Every line here is a generic one -
 * the app carries nobody's text and neither does this file.
 */

// --- what a heading is ----------------------------------------------------------

test('a line in capitals is a heading, and a line with any lowercase letter in it is not', () => {
  expect(isNorthHeading('FIRST SECTION')).toBe(true)
  expect(isNorthHeading('First section')).toBe(false)
  expect(isNorthHeading('first section')).toBe(false)
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
  expect(isNorthHeading('  FIRST SECTION  ')).toBe(true)
})

// --- the parts ---------------------------------------------------------------------

test('a heading holds the lines under it, up to the next heading', () => {
  const parts = parseNorth('FIRST SECTION\nline under it\nsecond line under it\nSECOND SECTION\nline under it')
  expect(parts).toEqual([
    { kind: 'section', heading: 'FIRST SECTION', lines: ['line under it', 'second line under it'] },
    { kind: 'section', heading: 'SECOND SECTION', lines: ['line under it'] },
  ])
})

test('a blank line ends a section, and the lines after it are free text, always shown', () => {
  const parts = parseNorth('FIRST SECTION\nline under it\n\nfree line here\nsecond free line here')
  expect(parts).toEqual([
    { kind: 'section', heading: 'FIRST SECTION', lines: ['line under it'] },
    { kind: 'lines', lines: ['free line here', 'second free line here'] },
  ])
})

test('the lines before the first heading are a free part, first', () => {
  const parts = parseNorth('First line here\nSecond line here\n\nFIRST SECTION\nline under it')
  expect(parts).toEqual([
    { kind: 'lines', lines: ['First line here', 'Second line here'] },
    { kind: 'section', heading: 'FIRST SECTION', lines: ['line under it'] },
  ])
})

test('a text with no heading is its blocks, one part per block, exactly as the page has always read it', () => {
  const parts = parseNorth('First line here\nSecond line here\n\nThird line here\n\n\n\nFourth line here')
  expect(parts).toEqual([
    { kind: 'lines', lines: ['First line here', 'Second line here'] },
    { kind: 'lines', lines: ['Third line here'] },
    { kind: 'lines', lines: ['Fourth line here'] },
  ])
  expect(hasNorthHeadings('First line here\n\nSecond line here')).toBe(false)
  expect(hasNorthHeadings('First line here\n\nFIRST SECTION\nline under it')).toBe(true)
})

test('a heading with nothing under it is a section with no lines, and a heading straight after a heading is the same', () => {
  expect(parseNorth('FIRST SECTION\n\nfree line here')).toEqual([
    { kind: 'section', heading: 'FIRST SECTION', lines: [] },
    { kind: 'lines', lines: ['free line here'] },
  ])
  expect(parseNorth('FIRST SECTION\nSECOND SECTION\nline under it')).toEqual([
    { kind: 'section', heading: 'FIRST SECTION', lines: [] },
    { kind: 'section', heading: 'SECOND SECTION', lines: ['line under it'] },
  ])
})

test('two blank lines are one gap, and lines are read trimmed', () => {
  expect(parseNorth('  First line here  \n\n\n\n  FIRST SECTION \n  line under it  ')).toEqual([
    { kind: 'lines', lines: ['First line here'] },
    { kind: 'section', heading: 'FIRST SECTION', lines: ['line under it'] },
  ])
})

test('an empty text is no parts at all, and nothing about parsing touches the text itself', () => {
  expect(parseNorth('')).toEqual([])
  expect(parseNorth('\n\n')).toEqual([])
  const typed = 'First line here\n\nFIRST SECTION\nline under it\n\n'
  parseNorth(typed)
  expect(typed).toBe('First line here\n\nFIRST SECTION\nline under it\n\n')
})
