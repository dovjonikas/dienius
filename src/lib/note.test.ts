import { expect, test } from 'vitest'
import { insertSectionHeading, parseNote, sectionLabel, SECTION_TITLE_MAX } from './note'

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

test('a heading written by the button opens its own line, with room above it', () => {
  const { text, caret } = insertSectionHeading('Rice and chicken', 16)
  expect(text).toBe('Rice and chicken\n\n## ')
  expect(text.slice(caret)).toBe('')
  expect(parseNote(text).sections).toHaveLength(1)
})

test('the button does not stack blank lines on a note that already ends in them', () => {
  expect(insertSectionHeading('Rice\n', 5).text).toBe('Rice\n\n## ')
  expect(insertSectionHeading('Rice\n\n', 6).text).toBe('Rice\n\n## ')
  expect(insertSectionHeading('Rice\n\n\n', 7).text).toBe('Rice\n\n\n## ')
})

test('an empty note gets the heading and nothing above it', () => {
  expect(insertSectionHeading('', 0)).toEqual({ text: '## ', caret: 3 })
})

test('a line already written becomes a choice when the caret is at its start', () => {
  const { text, caret } = insertSectionHeading('Omelette\n\nCurd with berries', 10)
  expect(text).toBe('Omelette\n\n## Curd with berries')
  expect(text.slice(caret)).toBe('Curd with berries')
  expect(parseNote(text).sections[0].title).toBe('Curd with berries')
})

test('a caret past the end of the text is the end of the text', () => {
  expect(insertSectionHeading('Rice', 999).text).toBe('Rice\n\n## ')
  expect(insertSectionHeading('Rice', -3).text).toBe('## Rice')
})

test('a second heading is not started while the first one is still empty', () => {
  expect(insertSectionHeading('Rice\n\n## ', 9)).toEqual({ text: 'Rice\n\n## ', caret: 9 })
  expect(insertSectionHeading('## ', 3)).toEqual({ text: '## ', caret: 3 })
  // Empty here, but with the note going on under it: still nothing to add.
  expect(insertSectionHeading('## \nsoup', 3).text).toBe('## \nsoup')
  // The moment something is typed into it, the button works again.
  expect(insertSectionHeading('## S', 4).text).toBe('## S\n\n## ')
})
