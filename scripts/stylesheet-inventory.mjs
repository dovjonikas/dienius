/**
 * What the stylesheet actually contains, counted.
 *
 * `npm run inventory` prints, and `--md` writes docs/audit/NIGHT.md.
 *
 * The v2.20 brief asked for this before anything was touched, and the reason
 * is the one every audit in this repo has: a scale is a claim, and a claim
 * nobody counts is a claim that drifts. CONVENTIONS section 5 declares four
 * type steps and nine spacing steps; whether the file uses four and nine, or
 * eleven and thirty-one, is a fact rather than an opinion, and this is where
 * that fact comes from.
 *
 * It reads the file rather than the rendered page on purpose. A rendered
 * page shows what won; this shows what was written, which is what has to be
 * tidied. The sweep (scripts/sweep.mjs) is the other half and measures the
 * page.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const FILE = join(here, '..', 'src', 'styles.css')

/** Comments become spaces of the same length, so line numbers hold. */
const css = readFileSync(FILE, 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

const lines = css.split('\n')

/**
 * Every `prop: value` declaration with its line, for the props asked for.
 * @param {string[]} props
 * @returns {{ line: number, prop: string, value: string }[]}
 */
function declarations(props) {
  /** @type {{ line: number, prop: string, value: string }[]} */
  const out = []
  const wanted = new RegExp(`(?:^|[{;])\\s*(${props.join('|')})\\s*:\\s*([^;}]+)`, 'g')
  lines.forEach((text, i) => {
    for (const m of text.matchAll(wanted)) out.push({ line: i + 1, prop: m[1], value: m[2].trim() })
  })
  return out
}

/**
 * Counts of a value, most used first.
 * @param {string[]} values
 * @returns {[string, number][]}
 */
function tally(values) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
}

/**
 * The declarations that set a custom property, which is where a scale is written.
 * @param {string} re
 */
function tokenDefinitions(re) {
  return declarations([re]).map(d => d.prop)
}

// --- 1. type ---------------------------------------------------------------

const fontSizes = declarations(['font-size'])
const fontSizeUses = tally(fontSizes.map(d => d.value))
const fontSizeLiterals = fontSizes.filter(d => /\d/.test(d.value) && !/var\(--t-/.test(d.value) && d.value !== '0')

// --- 2. spacing ------------------------------------------------------------

const SPACE_PROPS = [
  'padding',
  'margin',
  'gap',
  'row-gap',
  'column-gap',
  'padding-(?:top|right|bottom|left|inline|block)',
  'margin-(?:top|right|bottom|left|inline|block)',
]
const spacing = declarations(SPACE_PROPS)
/**
 * Each token or literal used as a length, one entry per occurrence.
 * @param {string} value
 * @returns {string[]}
 */
function spacingAtoms(value) {
  /** @type {string[]} */
  const atoms = []
  for (const m of value.matchAll(/var\((--s\d)\)/g)) atoms.push(m[1])
  for (const m of value.matchAll(/(?<![\w-])(-?\d+(?:\.\d+)?)px/g)) atoms.push(`${Math.abs(Number(m[1]))}px`)
  return atoms
}
const spacingUses = tally(spacing.flatMap(d => spacingAtoms(d.value)))

// --- 3. radius -------------------------------------------------------------

const radii = declarations(['border-radius', 'border-[a-z]+-radius'])
const radiusUses = tally(radii.map(d => d.value))

// --- 4. borders ------------------------------------------------------------

const borders = declarations(['border', 'border-(?:top|right|bottom|left)', 'outline'])
  .filter(d => d.value !== 'none' && d.value !== '0' && !/^0 /.test(d.value))
const borderUses = tally(borders.map(d => d.value))

// --- 5. colours that are not tokens ---------------------------------------

const COLOUR_PROPS = ['color', 'background', 'background-color', 'border-color', 'fill', 'stroke', 'box-shadow']
/** @type {{ line: number, prop: string, colour: string }[]} */
const rawColours = []
for (const d of declarations(COLOUR_PROPS)) {
  // Inside a :root or a theme block a literal is the token's own definition,
  // which is the one place a colour is written down.
  const isDefinition = /^\s*--/.test(d.prop)
  if (isDefinition) continue
  for (const m of d.value.matchAll(/#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/gi)) {
    rawColours.push({ line: d.line, prop: d.prop, colour: m[0] })
  }
}
const rawColourUses = tally(rawColours.map(c => c.colour))

// --- 6. the accent ---------------------------------------------------------

/** @type {{ line: number, text: string }[]} */
const accentUses = []
lines.forEach((text, i) => {
  if (/--accent\b/.test(text) && !/^\s*--accent/.test(text)) accentUses.push({ line: i + 1, text: text.trim() })
})

// --- 7. movement -----------------------------------------------------------

const transitions = declarations(['transition', 'transition-duration', 'animation', 'animation-duration'])
const durations = tally(
  transitions.flatMap(d => [...d.value.matchAll(/var\((--dur[a-z-]*)\)|(\d+(?:\.\d+)?m?s)/g)].map(m => m[1] ?? m[2])),
)
const keyframes = tally([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]))

// --- the report ------------------------------------------------------------

/**
 * @param {string} title
 * @param {[string, number][]} rows
 * @param {string} [note]
 */
function section(title, rows, note) {
  const body = rows.map(([value, count]) => `| \`${value}\` | ${count} |`).join('\n')
  return `### ${title}\n\n${note ? note + '\n\n' : ''}| value | uses |\n| --- | --- |\n${body}\n`
}

const declaredType = tokenDefinitions('--t-[a-z0-9-]+')
const declaredSpace = tokenDefinitions('--s[0-9]')

const report = [
  '# The stylesheet, counted',
  '',
  "> Generated. `npm run inventory -- --md` rewrites this file; the account beside it",
  '> is in NIGHT.md. Read from `src/styles.css` rather than the rendered page:',
  '> a rendered page shows what won, and this shows what was written, which is what',
  '> gets tidied. The sweep is the other half and measures the page.',
  '',
  `**Declared type steps:** ${[...new Set(declaredType)].sort().join(', ')}`,
  '',
  `**Declared spacing steps:** ${[...new Set(declaredSpace)].sort().join(', ')}`,
  '',
  '## Counts',
  '',
  `- font-size declarations: **${fontSizes.length}**, of which literals: **${fontSizeLiterals.length}**`,
  `- distinct spacing values in use: **${spacingUses.length}**`,
  `- distinct border-radius values: **${radiusUses.length}**`,
  `- distinct border and outline values: **${borderUses.length}**`,
  `- colour literals outside a token definition: **${rawColours.length}** in **${rawColourUses.length}** distinct values`,
  `- lines reading the accent: **${accentUses.length}**`,
  `- transition and animation declarations: **${transitions.length}**, in **${durations.length}** distinct durations`,
  `- keyframes: **${keyframes.length}**`,
  '',
  section('Type', fontSizeUses),
  fontSizeLiterals.length
    ? `#### font-size literals\n\n${fontSizeLiterals.map(d => `- L${d.line} \`${d.value}\``).join('\n')}\n`
    : '',
  section('Spacing', spacingUses),
  section('Radius', radiusUses),
  section('Borders and outlines', borderUses),
  section('Colour literals', rawColourUses),
  rawColours.length ? `#### where\n\n${rawColours.map(c => `- L${c.line} \`${c.prop}\`: \`${c.colour}\``).join('\n')}\n` : '',
  section('Movement', durations),
  section('Keyframes', keyframes),
  `### The accent, line by line\n\n${accentUses.map(a => `- L${a.line} \`${a.text.slice(0, 110)}\``).join('\n')}\n`,
].join('\n')

if (process.argv.includes('--md')) {
  const out = join(here, '..', 'docs', 'audit', 'NIGHT-COUNTS.md')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, report)
  console.log(`written to docs/audit/NIGHT-COUNTS.md`)
}

console.log(
  [
    `font-size declarations ${fontSizes.length} (literals ${fontSizeLiterals.length})`,
    `spacing values ${spacingUses.length}`,
    `radius values ${radiusUses.length}`,
    `border values ${borderUses.length}`,
    `colour literals ${rawColours.length} in ${rawColourUses.length} values`,
    `accent lines ${accentUses.length}`,
    `transitions ${transitions.length} in ${durations.length} durations`,
    `keyframes ${keyframes.length}`,
  ].join('\n'),
)
