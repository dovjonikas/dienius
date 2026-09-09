import { expect, test } from 'vitest'
import { parseNote, sectionLabel, SECTION_TITLE_MAX } from './note'

// A note is a string and stays one. The only thing read out of it is a line
// beginning with "## ", and everything below is a case that has to keep
// working for the notes people already wrote.

test('a note with no heading is the whole intro, and has no sections', () => {
  const note = 'Rice, chicken, whatever green is in the fridge.\n  200 g rice'
  expect(parseNote(note)).toEqual({ intro: note, sections: [] })
})

test('a heading starts a section, and what is above it is the intro', () => {
  const parsed = parseNote('Pick one.\n\n## Chicken and rice\n200 g rice\n300 g chicken')
  expect(parsed.intro).toBe('Pick one.')
  expect(parsed.sections).toEqual([{ title: 'Chicken and rice', body: '200 g rice\n300 g chicken' }])
})

test('a note that opens on a heading has no intro', () => {
  const parsed = parseNote('## One\nfirst\n## Two\nsecond')
  expect(parsed.intro).toBe('')
  expect(parsed.sections.map(s => s.title)).toEqual(['One', 'Two'])
  expect(parsed.sections.map(s => s.body)).toEqual(['first', 'second'])
})

test('a heading with nothing under it stays, with an empty body', () => {
  const parsed = parseNote('## Empty\n## Full\nsomething')
  expect(parsed.sections).toEqual([
    { title: 'Empty', body: '' },
    { title: 'Full', body: 'something' },
  ])
})

test('nothing, and an empty string, are the same nothing', () => {
  expect(parseNote(undefined)).toEqual({ intro: '', sections: [] })
  expect(parseNote('')).toEqual({ intro: '', sections: [] })
})

test('carriage returns are line endings too', () => {
  const parsed = parseNote('Pick one.\r\n\r\n## Chicken\r\n200 g rice\r\n300 g chicken')
  expect(parsed.intro).toBe('Pick one.')
  expect(parsed.sections).toEqual([{ title: 'Chicken', body: '200 g rice\n300 g chicken' }])
})

test('an indent on the first line of a section survives', () => {
  // It is what makes a line render fixed-width - see NoteLines - so trimming
  // the body would quietly change how the section reads.
  const parsed = parseNote('## Amounts\n  200 g rice\n  300 g chicken')
  expect(parsed.sections[0].body).toBe('  200 g rice\n  300 g chicken')
})

test('blank lines inside a section are kept, and blank edges are not', () => {
  const parsed = parseNote('## One\n\nfirst\n\nsecond\n\n\n## Two\nx')
  expect(parsed.sections[0].body).toBe('first\n\nsecond')
})

test('only "## " is a heading - "##" alone, "###" and a mid-line one are text', () => {
  const parsed = parseNote('##nospace\n### deeper\nsee ## this\n#### four')
  expect(parsed.sections).toEqual([])
  expect(parsed.intro).toBe('##nospace\n### deeper\nsee ## this\n#### four')
})

test('a heading is trimmed, and the hash is not part of it', () => {
  expect(parseNote('##   Chicken and rice   ').sections[0].title).toBe('Chicken and rice')
})

test('nothing else in the text is read as formatting', () => {
  const note = '## List\n- *not emphasis*\n- _not either_\n- [not a link](x)\n- 1 > 2 & 3'
  expect(parseNote(note).sections[0].body).toBe('- *not emphasis*\n- _not either_\n- [not a link](x)\n- 1 > 2 & 3')
})

test('a long heading is cut for a control and never in the data', () => {
  const long = 'A'.repeat(SECTION_TITLE_MAX + 20)
  expect(parseNote(`## ${long}`).sections[0].title).toBe(long)
  expect(sectionLabel(long)).toHaveLength(SECTION_TITLE_MAX)
  expect(sectionLabel(long).endsWith('…')).toBe(true)
  expect(sectionLabel('short')).toBe('short')
})
