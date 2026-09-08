#!/usr/bin/env node
/**
 * The privacy guard: refuses to let the owner's own life into a public repo.
 *
 * `github.com/Quicasha/dienius` is public and git history does not forget.
 * The app is built by living in it, which means the person building it is
 * constantly one `git add -A` away from committing their real schedule,
 * their goals, the names of their other projects, or a backup path with a
 * relative's name in it. That is not hypothetical: this script exists
 * because a scratch test file pointing at another of the owner's apps was
 * swept into a commit by exactly that command, one commit before this one.
 *
 * **This is a privacy guard, not a content filter.** It is not here to
 * police language, tone or subject matter. It holds one list: the specific
 * strings that identify this particular person and nobody else, and it says
 * no when one of them appears in a tracked file.
 *
 * ## Why the list is hashed
 *
 * A list of private words, committed to a public repo, publishes the private
 * words. The guard would be the leak. So `personal-terms.json` holds SHA-256
 * hashes of the normalised terms and never the terms themselves: the check
 * hashes what it reads and compares, which catches the same strings without
 * anybody being able to read the list back out of it.
 *
 * The cost is that a term cannot be edited by hand. `--add` does it:
 *
 *   node scripts/no-personal-data.mjs --add "the exact phrase"
 *
 * ## What it can and cannot see
 *
 * Text is normalised to lowercase, split on anything that is not a letter or
 * a digit, and rebuilt as runs of one to four words. So "Other_Project",
 * "other project" and "Other-Project" are one thing to it, and a four-word
 * goal is findable while a five-word one is not. Single
 * common words are a bad term - "morning" would fire on half the repo - and
 * the adder warns about them rather than refusing, because only the owner
 * knows which of their words are theirs.
 *
 *   node scripts/no-personal-data.mjs          check every tracked file
 *   node scripts/no-personal-data.mjs --add X  add a term, by its hash
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LIST = join(HERE, 'personal-terms.json')

/** The longest run of words a term may be. Four covers a goal sentence's core. */
const MAX_WORDS = 4

/** Binary and generated files: nothing anybody types by hand lives in them. */
const SKIP = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|mp[34]|zip|pdf|lock)$/i

/** @param {string} term */
const hash = term => createHash('sha256').update(term).digest('hex').slice(0, 32)

/**
 * Text as the runs of words the guard compares.
 *
 * Lowercased and split on everything that is not a letter or a digit, so
 * punctuation, underscores, camel case boundaries and line breaks all stop
 * mattering. The same function normalises a term when it is added, which is
 * the only reason the two ever agree.
 *
 * Only the run lengths the list actually holds are built. Every length from
 * one to four over every tracked file is a few million strings, which is a
 * second on its own and past the test runner's patience with a hundred and
 * fifty other files rendering beside it - and a list of two-word terms needs
 * none of the one-, three- and four-word runs. The lengths are the one thing
 * about the terms that file may say out loud: "there are terms of two words"
 * is not a fact about anybody.
 *
 * @param {string} text
 * @param {number[] | number} [lengths] which run lengths to build, or a maximum
 * @returns {Map<string, number>}
 */
export function runsOf(text, lengths = MAX_WORDS) {
  const want = typeof lengths === 'number' ? Array.from({ length: lengths }, (_, i) => i + 1) : lengths
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const runs = new Map()
  for (let i = 0; i < words.length; i++) {
    for (const n of want) {
      if (i + n > words.length) continue
      const run = words.slice(i, i + n).join(' ')
      if (!runs.has(run)) runs.set(run, i)
    }
  }
  return runs
}

/** @param {string} term */
export function normalise(term) {
  return term.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ')
}

function loadList() {
  try {
    const list = JSON.parse(readFileSync(LIST, 'utf8'))
    return { terms: new Set(list.terms), lengths: list.lengths ?? [1, 2, 3, 4] }
  } catch {
    return { terms: new Set(), lengths: [] }
  }
}

/** Every file git is tracking, which is exactly the set that can be pushed. */
function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter(f => !SKIP.test(f))
}

/**
 * Every tracked file, checked. Returns one finding per file and term, with
 * the line it was on - and never the term itself, because the point of the
 * hashing is that the guard cannot say it either.
 *
 * @param {{ files?: string[]; terms?: Set<string>; lengths?: number[]; root?: string }} [opts]
 */
export function check({ files = trackedFiles(), terms, lengths, root = ROOT } = {}) {
  if (terms === undefined) {
    const list = loadList()
    terms = list.terms
    lengths = lengths ?? list.lengths
  }
  // A set of terms handed in without its lengths - which is every test - has
  // to be looked for at every length, because nothing else knows them.
  const runLengths = lengths ?? [1, 2, 3, 4]
  /** @type {{ file: string; line: number; words: number }[]} */
  const findings = []
  if (terms.size === 0) return findings
  for (const file of files) {
    let text
    try {
      text = readFileSync(join(root, file), 'utf8')
    } catch {
      continue
    }
    // The list's own file holds the hashes, and a hash of a term is not the
    // term - but reading it costs nothing to skip and saying so here is
    // cheaper than somebody wondering later.
    if (file.endsWith('personal-terms.json')) continue
    const runs = runsOf(text, runLengths)
    const hit = new Set()
    for (const [run] of runs) {
      const h = hash(run)
      if (terms.has(h) && !hit.has(h)) {
        hit.add(h)
        // Which line, found by re-reading rather than tracked through the
        // run builder: this happens once per finding, and a finding is rare.
        const lines = text.split('\n')
        const needle = run.split(' ')
        const at = lines.findIndex(line => {
          const w = line.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
          return w.some((_, i) => needle.every((word, k) => w[i + k] === word))
        })
        findings.push({ file, line: at + 1, words: needle.length })
      }
    }
  }
  return findings
}

/** @param {string} term */
function add(term) {
  const normalised = normalise(term)
  if (!normalised) {
    console.error('Nothing to add: that term has no letters or digits in it.')
    process.exit(2)
  }
  const words = normalised.split(' ')
  if (words.length > MAX_WORDS) {
    console.error(`Too long: the guard compares runs of up to ${MAX_WORDS} words, and that is ${words.length}.`)
    console.error('Use the distinctive part of it instead.')
    process.exit(2)
  }
  const list = JSON.parse(readFileSync(LIST, 'utf8'))
  const h = hash(normalised)
  if (list.terms.includes(h)) {
    console.log('Already on the list.')
    return
  }
  list.terms.push(h)
  list.terms.sort()
  // How long the terms are, so a check builds only the runs it could match.
  list.lengths = [...new Set([...(list.lengths ?? []), words.length])].sort()
  writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`)
  console.log(`Added. The list now holds ${list.terms.length} terms, none of them readable.`)
  if (words.length === 1) {
    console.log('One word: check it is a word only you use. "morning" would fire on half the repo.')
  }
}

const arg = process.argv.indexOf('--add')
if (arg !== -1) {
  add(process.argv[arg + 1] ?? '')
} else if (process.argv[1] && process.argv[1].endsWith('no-personal-data.mjs')) {
  const findings = check()
  if (findings.length === 0) {
    console.log('No personal data in any tracked file.')
    process.exit(0)
  }
  console.error('')
  console.error('STOP. Something on the private list is in a tracked file.')
  console.error('')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  (a run of ${f.words} word${f.words === 1 ? '' : 's'})`)
  }
  console.error('')
  console.error('This repo is public and git history does not forget. The guard')
  console.error('cannot print what it matched - the list is hashed so that the')
  console.error('guard is not itself the leak - so open the line above and look.')
  console.error('')
  console.error('Take it out and replace it with something generic. If the commit')
  console.error('is already made and not yet pushed, amend it rather than adding a')
  console.error('second commit on top: the first one still carries the text.')
  console.error('')
  process.exit(1)
}
