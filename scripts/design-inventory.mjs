/**
 * Every visual value the stylesheet uses, counted and located.
 *
 * The design pass (docs/DESIGN-AUDIT.md) starts from what is actually written
 * rather than from what the screens look like they use: how many type sizes,
 * which spacing values are not on the scale, how many corners, where a border
 * draws a line, where a shadow lifts something that is not a layer, which
 * colours are written as literals outside the theme's own blocks. The last
 * stage of the pass runs it again to say what is left.
 *
 *   node scripts/design-inventory.mjs            a summary, then every finding
 *   node scripts/design-inventory.mjs --json     the same as JSON
 *
 * It reads src/styles.css and the components' class names, and it changes
 * nothing. A value inside a token block - :root, a theme, a density, a
 * preview card's own variables - is the definition of a token, not a use of
 * one, so it is counted apart.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {{ property: string, value: string, line: number }} Declaration */
/** @typedef {{ selector: string, at: string[], line: number, declarations: Declaration[] }} Rule */
/** @typedef {{ head: string, line: number, declarations: Declaration[] }} Frame */
/** @typedef {{ rule: Rule, d: Declaration }} Use */
/** @typedef {{ value: string, count: number }} Tally */

const root = join(fileURLToPath(import.meta.url), '..', '..')
const CSS_PATH = join(root, 'src', 'styles.css')
const JSON_OUT = process.argv.includes('--json')

/**
 * The rules of a stylesheet, flattened: selector, the at-rules around it, and
 * each declaration with its line.
 * @param {string} css
 * @returns {Rule[]}
 */
function parseRules(css) {
  /** @type {Rule[]} */
  const rules = []
  /** @type {Frame[]} */
  const stack = []
  let i = 0
  let line = 1
  let buffer = ''
  let bufferLine = 1
  while (i < css.length) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const stop = end < 0 ? css.length : end + 2
      for (let k = i; k < stop; k++) if (css[k] === '\n') line++
      i = stop
      continue
    }
    if (ch === '{') {
      stack.push({ head: buffer.trim(), line: bufferLine, declarations: [] })
      buffer = ''
      bufferLine = line
      i++
      continue
    }
    if (ch === '}') {
      const top = stack.pop()
      if (top && buffer.trim()) top.declarations.push(...declarationsIn(buffer, bufferLine))
      if (top && !top.head.startsWith('@')) {
        rules.push({
          selector: top.head.replace(/\s+/g, ' '),
          at: stack.filter(s => s.head.startsWith('@')).map(s => s.head.replace(/\s+/g, ' ')),
          line: top.line,
          declarations: top.declarations,
        })
      }
      buffer = ''
      bufferLine = line
      i++
      continue
    }
    if (ch === ';' && stack.length > 0) {
      stack[stack.length - 1].declarations.push(...declarationsIn(buffer, bufferLine))
      buffer = ''
      bufferLine = line
      i++
      continue
    }
    if (buffer.trim() === '' && !/\s/.test(ch)) bufferLine = line
    buffer += ch
    if (ch === '\n') line++
    i++
  }
  return rules
}

/**
 * @param {string} text
 * @param {number} line
 * @returns {Declaration[]}
 */
function declarationsIn(text, line) {
  const colon = text.indexOf(':')
  if (colon < 0) return []
  const property = text.slice(0, colon).trim().toLowerCase()
  const value = text.slice(colon + 1).trim()
  if (!property || property.includes('{')) return []
  return [{ property, value, line }]
}

/**
 * A block that defines tokens rather than using them.
 * @param {Rule} rule
 */
function isTokenBlock(rule) {
  return (
    /^:root\b/.test(rule.selector) ||
    /\[data-theme/.test(rule.selector) ||
    /\[data-density/.test(rule.selector) ||
    /\[data-text-size/.test(rule.selector) ||
    /\.theme-card\[data-pv/.test(rule.selector)
  )
}

/**
 * Every file under a folder whose name matches, tests left out.
 * @param {string} dir
 * @param {RegExp} pattern
 * @param {string[]} [out]
 * @returns {string[]}
 */
function filesUnder(dir, pattern, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) filesUnder(full, pattern, out)
    else if (pattern.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

/**
 * @param {string[]} values
 * @returns {Tally[]}
 */
function tally(values) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

const css = readFileSync(CSS_PATH, 'utf8')
const rules = parseRules(css)
const uses = rules.filter(r => !isTokenBlock(r))
const components = filesUnder(join(root, 'src'), /\.tsx$/)
const modules = filesUnder(join(root, 'src'), /\.ts$/)

/**
 * @param {Use} use
 */
const where = ({ rule, d }) => ({ line: d.line, selector: rule.selector.slice(0, 90), value: d.value })

/**
 * Every declaration outside the token blocks that passes the test.
 * @param {(d: Declaration, rule: Rule) => boolean} test
 * @returns {Use[]}
 */
const all = test => uses.flatMap(rule => rule.declarations.filter(d => test(d, rule)).map(d => ({ rule, d })))

// --- type -----------------------------------------------------------------
const fontSizes = all(d => d.property === 'font-size')
const fontSizeLiterals = fontSizes.filter(
  ({ d }) => !/^var\(--t-/.test(d.value) && !/^(inherit|100%|1em|0)$/.test(d.value),
)
const lineHeights = all(d => d.property === 'line-height')
const fontWeights = all(d => d.property === 'font-weight')
const letterSpacings = all(d => d.property === 'letter-spacing')

// --- spacing --------------------------------------------------------------
const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/
const spacing = all(d => SPACING.test(d.property))
/** A length written as a number rather than a step: 0 and a 1px hairline aside. */
const offScale = spacing.filter(({ d }) => {
  const stripped = d.value.replace(/var\([^)]*\)/g, '').replace(/calc\([^)]*\)/g, '')
  const lengths = stripped.match(/-?[0-9.]+(px|rem|em)\b/g) ?? []
  return lengths.some(l => !/^-?(0|1)px$/.test(l))
})

// --- shape ----------------------------------------------------------------
const radii = all(d => d.property === 'border-radius' || /^border-(top|bottom)-(left|right)-radius$/.test(d.property))
const radiusLiterals = radii.filter(
  ({ d }) => !/^(var\(--r-[a-z]+\)\s*)+$/.test(d.value) && d.value !== 'inherit' && d.value !== '0',
)

// Defined in the stylesheet, or set on an element from code - a block's
// colour, a preview card's theme - which the stylesheet cannot see.
const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))
for (const file of [...components, ...modules]) {
  for (const m of readFileSync(file, 'utf8').matchAll(/['"`](--[a-z0-9-]+)['"`]/g)) defined.add(m[1])
}
const undefinedTokens = uses.flatMap(rule =>
  rule.declarations.flatMap(d =>
    [...d.value.matchAll(/var\((--[a-z0-9-]+)(\s*,[^)]*)?\)/g)]
      .filter(m => !defined.has(m[1]) && !m[2])
      .map(m => ({ ...where({ rule, d }), token: m[1] })),
  ),
)

// --- lines and lifts ------------------------------------------------------
const borders = all(d => /^border(-(top|right|bottom|left))?$/.test(d.property))
const visibleBorders = borders.filter(({ d }) => !/^(none|0)$/.test(d.value) && !/\btransparent\b/.test(d.value))
const shadowDecls = all(d => d.property === 'box-shadow' && d.value !== 'none')
/**
 * A ring is a spread with no blur - a selection or focus edge drawn as a
 * shadow, not a lift.
 * @param {string} value
 */
const isRing = value =>
  topLevelParts(value).every(part => /^\s*(inset\s+)?0\s+0\s+0\s+[0-9.]+px\b/.test(part) || /^\s*inset\b/.test(part))

/**
 * A comma-separated value split at its own commas, not at the commas inside
 * a var() fallback or a color-mix().
 * @param {string} value
 */
function topLevelParts(value) {
  /** @type {string[]} */
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}
const rings = shadowDecls.filter(({ d }) => isRing(d.value))
const shadows = shadowDecls.filter(({ d }) => !isRing(d.value))
/** Something that covers the page: a sheet, a panel, a menu, a bubble, a card opened over the day. */
const LAYER =
  /(sheet|panel|dialog|popover|menu|toast|bubble|overlay|palette|peek|\.tip\b|modal|scrim|window|picker|notice|drawer|dropdown|\.task-detail\b|\.shortcuts\b|\.north-card\b|\.scratch\b|\.replan\b|\.day-card\b|\.note-reader\b|\.tour-card\b|\.tour-offer\b|\.north-line-more\b|\.week-col-ask\b|\.task-gap-offers\b|\.floating-clock\b|\.note-task\b)/
const shadowsOffLayers = shadows.filter(({ rule }) => !LAYER.test(rule.selector))
const outlines = all(d => d.property === 'outline' && !/^(none|0)$/.test(d.value))

// --- motion ---------------------------------------------------------------
const motion = all(d => /^(transition|animation)(-duration)?$/.test(d.property))
// A zero is not a duration: `visibility 0s linear var(--dur)` is how a layer
// stays visible until its fade has finished.
const motionLiterals = motion.filter(({ d }) => /\b(?!0s\b)[0-9.]+m?s\b/.test(d.value.replace(/var\([^)]*\)/g, '')))
const easings = tally(
  motion.flatMap(({ d }) => d.value.match(/cubic-bezier\([^)]*\)|\bease(-in|-out|-in-out)?\b|\blinear\b|var\(--ease[a-z-]*\)/g) ?? []),
)

// --- colour ---------------------------------------------------------------
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)|\b(white|black)\b/
// A mask's black is coverage, not a colour, and a literal inside a var()'s
// fallback is only reached when the token is missing.
/** @param {string} value */
const withoutFallbacks = value => value.replace(/var\((--[a-z0-9-]+),[^()]*(\([^()]*\)[^()]*)*\)/g, 'var($1)')
const colourLiterals = all(
  d =>
    !d.property.startsWith('--') &&
    !/mask/.test(d.property) &&
    COLOUR_LITERAL.test(withoutFallbacks(d.value)) &&
    !/url\(/.test(d.value),
)

// --- components -----------------------------------------------------------
/** @type {Map<string, number>} */
const buttonKinds = new Map()
/** @type {{ file: string, line: number, className: string }[]} */
const ownButtons = []
for (const file of components) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\bbtn-(primary|secondary|danger|[a-z-]+)\b/g)) {
    buttonKinds.set(m[0], (buttonKinds.get(m[0]) ?? 0) + 1)
  }
  for (const m of text.matchAll(/<button\b[^>]*?className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
    const cls = (m[1] ?? m[2] ?? '').trim()
    if (/\bbtn-/.test(cls)) continue
    const line = text.slice(0, m.index).split(/\r?\n/).length
    ownButtons.push({ file: relative(root, file).replace(/\\/g, '/'), line, className: cls.slice(0, 60) })
  }
}

const report = {
  file: 'src/styles.css',
  rules: rules.length,
  tokenBlocks: rules.length - uses.length,
  type: {
    sizes: tally(fontSizes.map(({ d }) => d.value)),
    sizeLiterals: fontSizeLiterals.map(where),
    lineHeights: tally(lineHeights.map(({ d }) => d.value)),
    weights: tally(fontWeights.map(({ d }) => d.value)),
    letterSpacings: tally(letterSpacings.map(({ d }) => d.value)),
  },
  spacing: {
    declarations: spacing.length,
    offScale: offScale.map(where),
  },
  shape: {
    radii: tally(radii.map(({ d }) => d.value)),
    radiusLiterals: radiusLiterals.map(where),
    undefinedTokens,
  },
  lines: {
    borders: borders.length,
    visible: visibleBorders.length,
    visibleValues: tally(visibleBorders.map(({ d }) => d.value)),
    outlines: tally(outlines.map(({ d }) => d.value)),
  },
  shadows: {
    total: shadows.length,
    rings: rings.length,
    values: tally(shadows.map(({ d }) => d.value)),
    offLayers: shadowsOffLayers.map(where),
  },
  motion: {
    declarations: motion.length,
    literals: motionLiterals.map(where),
    easings,
  },
  colour: {
    literals: colourLiterals.map(where),
  },
  buttons: {
    kinds: tally([...buttonKinds.entries()].flatMap(([value, count]) => Array(count).fill(value))),
    ownClass: ownButtons,
  },
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2))
} else {
  /** @param {Tally[]} rows */
  const list = rows => rows.map(r => `${r.count} x ${r.value}`).join(', ')
  const out = [
    `${report.rules} rules in ${report.file}, ${report.tokenBlocks} of them token blocks`,
    '',
    `type sizes: ${list(report.type.sizes)}`,
    `type size literals: ${report.type.sizeLiterals.length}`,
    `line heights: ${list(report.type.lineHeights)}`,
    `weights: ${list(report.type.weights)}`,
    `letter spacing: ${list(report.type.letterSpacings)}`,
    `spacing declarations: ${report.spacing.declarations}, off the scale: ${report.spacing.offScale.length}`,
    `corners: ${list(report.shape.radii)}`,
    `corner literals: ${report.shape.radiusLiterals.length}, undefined tokens used: ${report.shape.undefinedTokens.length}`,
    `borders: ${report.lines.borders}, drawn: ${report.lines.visible}`,
    `shadows: ${report.shadows.total} and ${report.shadows.rings} rings drawn as shadows; shadows on something that is not a layer: ${report.shadows.offLayers.length}`,
    `motion declarations: ${report.motion.declarations}, literal durations: ${report.motion.literals.length}`,
    `easings: ${list(report.motion.easings)}`,
    `colour literals outside token blocks: ${report.colour.literals.length}`,
    `button kinds: ${list(report.buttons.kinds)}, buttons with a class of their own: ${report.buttons.ownClass.length}`,
  ]
  /**
   * @param {string} title
   * @param {{ line: number, selector?: string, value?: string, token?: string }[]} rows
   */
  const detail = (title, rows) => {
    if (rows.length === 0) return
    out.push('', `## ${title}`)
    for (const r of rows) out.push(`  ${r.line}  ${r.selector ?? ''}  ${r.token ?? r.value ?? ''}`)
  }
  detail('type size literals', report.type.sizeLiterals)
  detail('spacing off the scale', report.spacing.offScale)
  detail('corner literals', report.shape.radiusLiterals)
  detail('undefined tokens', report.shape.undefinedTokens)
  detail('shadows on something that is not a layer', report.shadows.offLayers)
  detail('literal durations', report.motion.literals)
  detail('colour literals', report.colour.literals)
  console.log(out.join('\n'))
}
