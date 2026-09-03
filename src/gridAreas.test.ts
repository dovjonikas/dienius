import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

/**
 * Every `grid-area: name` in the stylesheet names an area that exists.
 *
 * CSS is silent about this and the failure is spectacular: a child asking
 * for an area no template declares is not ignored, it is placed in an
 * *implicit* track, which invents columns the layout was never designed
 * around. That is what happened on an empty day with the Tasks focus - two
 * rules both collapsed `.day-view` to two columns, one called the surviving
 * column `tasks` and the other called it `pane`, and the day header ended up
 * 151px wide with its controls wrapped onto three lines while the task
 * column sat in a fourth column nobody had declared.
 *
 * A text check rather than a rendered one, because jsdom has no layout and
 * this is a property of the stylesheet itself: the set of names children ask
 * for has to be a subset of the names some template offers. It cannot prove
 * that the right template is in force at the right moment - only the browser
 * can - but it catches the whole class of rename-one-side bugs, which is the
 * one that actually shipped.
 */
function stylesheet(): string {
  return readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf-8')
}

/** Every name used inside a `grid-template-areas` string, anywhere in the file. */
function declaredAreas(css: string): Set<string> {
  const names = new Set<string>()
  for (const block of css.matchAll(/grid-template-areas:\s*([^;]+);/g)) {
    for (const row of block[1].matchAll(/"([^"]*)"/g)) {
      for (const name of row[1].trim().split(/\s+/)) {
        // A dot is the spelling for "deliberately empty cell".
        if (name && name !== '.') names.add(name)
      }
    }
  }
  return names
}

/** Every name asked for by a `grid-area: name` shorthand. Line numbers so a failure says where. */
function requestedAreas(css: string): { name: string; line: number }[] {
  const out: { name: string; line: number }[] = []
  const lines = css.split('\n')
  lines.forEach((text, i) => {
    const match = text.match(/grid-area:\s*([a-zA-Z][\w-]*)\s*;/)
    // `grid-area: auto` and the numeric/line forms are not area names.
    if (match && match[1] !== 'auto' && match[1] !== 'inherit' && match[1] !== 'initial') {
      out.push({ name: match[1], line: i + 1 })
    }
  })
  return out
}

test('every grid-area names an area some template actually declares', () => {
  const css = stylesheet()
  const declared = declaredAreas(css)
  const missing = requestedAreas(css).filter(r => !declared.has(r.name))
  expect(missing.map(m => `${m.name} (styles.css:${m.line})`)).toEqual([])
})

/**
 * The two rules that collapse the day view to two columns have to agree
 * about what the surviving column is called, because both can match at once
 * - an empty day, with the Tasks focus.
 */
test('the first-run day and the Tasks focus name the task column the same way', () => {
  const css = stylesheet()
  const columnOf = (selector: string) => {
    const rule = css.match(new RegExp(`${selector}\\s*\\{[^}]*grid-template-areas:([^;]+);`))
    if (!rule) throw new Error(`no grid-template-areas for ${selector}`)
    const rows = [...rule[1].matchAll(/"([^"]*)"/g)].map(m => m[1].trim())
    return rows[rows.length - 1].split(/\s+/).at(-1)
  }
  expect(columnOf('\\.day-view\\.focus-tasks')).toBe('tasks')
  expect(columnOf('\\.day-view:has\\(\\.first-run\\)')).toBe('tasks')
})
