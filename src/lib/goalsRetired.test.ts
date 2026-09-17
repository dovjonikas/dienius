import { expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { actions } from './store'

/**
 * Goals are retired, v2.28 - see DECISIONS "North is one text, goals
 * retired". North is one text, and these read the source to hold that:
 * nothing shows a goal, nothing reads one, and nothing writes one.
 *
 * The data stays - a backup or an older device still holds goals and their
 * rules, and every field of them loads, merges and exports - so the few
 * files that carry the data are named here, and nothing else may touch it.
 */

const SRC = resolve(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : []
  })
}

const FILES = sourceFiles(SRC).map(file => ({
  path: relative(SRC, file).replace(/\\/g, '/'),
  text: readFileSync(file, 'utf8'),
}))

/** The words a file says, without what its comments say. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * Where goals and rules may still be read: the types, the guard on a file,
 * the load step and its one migration, and sync - the data, and nothing
 * that shows it.
 */
const DATA_LAYER = [
  'lib/types.ts',
  'lib/validate.ts',
  'lib/storage.ts',
  'lib/syncEntities.ts',
  'lib/syncMerge.ts',
  'lib/north.ts',
  // v2.28's validation, frozen for rotating shifts' older-device test: it is
  // the data layer's own tables as they were, goals and rules included.
  'lib/fixtures/validate-v2.28.ts',
]

test('nothing outside the data layer reads a goal or a rule', () => {
  const readers = FILES.filter(f => !DATA_LAYER.includes(f.path))
    .filter(f => /\.goals\b|\.ifThens\b|\bGoal\b|\bIfThenEntry\b|\bgoalId\b/.test(withoutComments(f.text)))
    .map(f => f.path)
  expect(readers).toEqual([])
})

test('no screen says goal to anybody', () => {
  const saying = FILES.filter(f => f.path.endsWith('.tsx'))
    .filter(f => /goal/i.test(withoutComments(f.text)))
    .map(f => f.path)
  expect(saying).toEqual([])
})

test('the store has no action for a goal or a rule', () => {
  expect(Object.keys(actions).filter(name => /goal|ifthen|rule/i.test(name))).toEqual([])
})

test('the stylesheet has no rule for a goal, its card or its rules', () => {
  // What the rules are, not what their notes remember.
  const css = readFileSync(join(SRC, 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  expect(css.match(/\.(north-goal|north-card|north-rule|rule-form|north-unfiled)[\w-]*/g) ?? []).toEqual([])
})

test('the load step retires goals, and so does every sync merge', () => {
  const storage = FILES.find(f => f.path === 'lib/storage.ts')!.text
  const sync = FILES.find(f => f.path === 'lib/syncClient.ts')!.text
  expect(storage).toMatch(/return retireGoals\(foldInbox\(/)
  expect(withoutComments(sync).match(/retireGoals\(/g)).toHaveLength(2)
})
