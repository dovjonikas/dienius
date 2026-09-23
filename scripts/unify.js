/**
 * The seven rules of one look, measured on the screen in front of it - the
 * owner's UI brief of 2026-09-22, docs/DESIGN.md "One look, seven rules".
 * Injected by `node scripts/sweep.mjs --unify`, which walks every screen the
 * sweep walks at 1920x1080 and on a 375x812 phone and reads `__unify(name)`
 * on each. Plain JavaScript in the page, like audit.js; it changes nothing.
 *
 * 1. One grid: every margin, padding and gap is a step of the scale.
 * 2. One left line in a card: the rows of a surface start where each other do.
 * 3. One control height in a row, one corner, and few type sizes.
 * 4. Nothing stretched: a field is as wide as what goes in it.
 * 5. One row stays one row: a row of controls never wraps.
 * 6. It fits: no page scroll where there should be none, never sideways.
 * 7. One frame: the title, the page and its first surface where every other
 *    screen has them - read here, compared across screens by the sweep.
 */
;(() => {
  const SCALE = [0, 4, 8, 12, 16, 24, 32, 48]
  const CONTROLS = 'button, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea, [role="button"], [role="combobox"]'

  /** @param {Element} el */
  const shown = el => {
    if (!(el instanceof HTMLElement)) return false
    if (el.closest('.visually-hidden, [aria-hidden="true"]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
  }

  /** @param {Element} el */
  const name = el => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : []
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '')
  }

  /** @param {Element} el */
  const words = el => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 30)

  /** A computed length's px, or null for auto, a percentage or a keyword. */
  const lengthOf = (/** @type {Element} */ el, /** @type {string} */ prop) => {
    const map = /** @type {any} */ (el).computedStyleMap?.()
    const v = map?.get(prop)
    if (!v) return null
    if (v.unit === 'px') return v.value
    return null
  }

  // ---- 1. one grid -------------------------------------------------------------------
  const rootStyle = getComputedStyle(document.documentElement)
  const token = (/** @type {string} */ n) => parseFloat(rootStyle.getPropertyValue(n))
  /** Half of what a control's height leaves round a line of the type scale. */
  function centring(/** @type {number} */ v) {
    const heights = ['--control-h', '--touch'].map(token).filter(Number.isFinite)
    const sizes = ['--t-xs', '--t-sm', '--t-md', '--t-lg'].map(token).filter(Number.isFinite)
    const leads = ['--lh-ui', '--lh-tight', '--lh-read'].map(token).filter(Number.isFinite)
    return heights.some(h => sizes.some(s => leads.some(l => Math.abs(2 * v + s * l - h) < 0.5)))
  }
  /** A box as tall or as wide as a touch target. */
  function touchTarget(/** @type {Element} */ el) {
    const touch = token('--touch')
    const r = el.getBoundingClientRect()
    return Math.abs(r.width - touch) < 0.5 || Math.abs(r.height - touch) < 0.5
  }
  /** Whether the start an indent makes is where another line in the same
   *  surface starts: the left of a word or a control outside this element. */
  function onAnEdge(/** @type {HTMLElement} */ el, /** @type {string} */ prop, /** @type {number} */ v, /** @type {CSSStyleDeclaration} */ cs) {
    const r = el.getBoundingClientRect()
    const x = prop === 'padding-left' ? r.left + parseFloat(cs.borderLeftWidth) + v : r.left
    let scope = el.parentElement
    for (let up = 0; scope && up < 6 && !isSurface(scope); up++) scope = scope.parentElement
    if (!scope) return false
    for (const other of scope.querySelectorAll('*')) {
      if (!(other instanceof HTMLElement) || other === el || el.contains(other) || other.contains(el) || !shown(other)) continue
      if (other.children.length && !other.matches(CONTROLS)) continue
      if (Math.abs(startOf(other) - x) < 1) return true
    }
    return false
  }
  function offScale(/** @type {Element[]} */ all) {
    const out = new Map()
    const props = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'row-gap', 'column-gap']
    for (const el of all) {
      for (const prop of props) {
        const v = lengthOf(el, prop)
        if (v === null || v === 0) continue
        // A one-pixel gap between two grounds is the line where they meet -
        // --hairline, a stroke - not a gap.
        if (v === 1 && prop.endsWith('gap')) continue
        const cs = getComputedStyle(el)
        // A line of text set on a control's centre line: equal room above and
        // below, a line of the type scale and the room one control tall -
        // rule 3's centre line, worked out from two tokens rather than chosen.
        if ((prop === 'padding-top' || prop === 'padding-bottom') && cs.paddingTop === cs.paddingBottom && centring(v)) continue
        // A negative margin that stands a field's words on the row's edge:
        // exactly its own padding and border - rule 2's left line.
        if (prop === 'margin-left' && v < 0 && Math.abs(-v - parseFloat(cs.paddingLeft) - parseFloat(cs.borderLeftWidth)) < 0.5) continue
        if (prop === 'margin-right' && v < 0 && Math.abs(-v - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)) < 0.5) continue
        // A negative margin that keeps a mark's touch target without the
        // target pushing its line taller: the target is a size, rule 3's.
        if (v < 0 && prop.startsWith('margin') && touchTarget(el)) continue
        // The mount node's room for the rail and for the phone's bar is those
        // bars' own size - the frame of rule 7, not a gap between things.
        if (el.id === 'root' && (prop === 'padding-left' || prop === 'padding-bottom')) continue
        // An indent that stands a line's start on another line's edge - the
        // meta under its title, a sentence on the answers' edge after a label
        // column, a list's words where the next list's words start - is rule
        // 2's left line, as wide as the label or the mark it steps past.
        if ((prop === 'padding-left' || prop === 'margin-left') && v > 0 && el instanceof HTMLElement && onAnEdge(el, prop, v, cs)) continue
        const n = Math.round(Math.abs(v) * 10) / 10
        if (SCALE.includes(n)) continue
        const key = `${name(el)} ${prop} ${Math.round(v * 10) / 10}px`
        out.set(key, (out.get(key) ?? 0) + 1)
      }
    }
    return [...out.keys()]
  }

  // ---- 2. one left line in a card ----------------------------------------------------------
  /** A surface: its own ground or edge, rounded, with room inside. */
  const isSurface = (/** @type {HTMLElement} */ el) => {
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' && el.tagName === 'NAV') return false
    const ground = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
    const radius = parseFloat(cs.borderTopLeftRadius) > 0
    const room = parseFloat(cs.paddingLeft) >= 8
    const r = el.getBoundingClientRect()
    return (ground || el.tagName === 'FORM' || el.getAttribute('role') === 'dialog') && radius && room && r.width >= 240 && r.height >= 80
  }
  /** Where a row starts to the eye: the left of its first word or control. */
  function startOf(/** @type {HTMLElement} */ row) {
    let left = Infinity
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const parent = node.parentElement
      if (!parent || !shown(parent)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      if (r.width > 0) left = Math.min(left, r.left)
    }
    for (const c of row.querySelectorAll(CONTROLS)) if (shown(c)) left = Math.min(left, c.getBoundingClientRect().left)
    if (row.matches(CONTROLS)) left = Math.min(left, row.getBoundingClientRect().left)
    return left
  }
  function leftLines(/** @type {HTMLElement[]} */ all) {
    const out = []
    for (const card of all) {
      if (!isSurface(card)) continue
      // A surface inside another is measured on its own, and its rows are not the outer one's.
      const rows = [...card.children].filter(c => {
        if (!(c instanceof HTMLElement) || !shown(c)) return false
        const cs = getComputedStyle(c)
        if (cs.position === 'absolute' || cs.position === 'fixed') return false
        if (c.getBoundingClientRect().width < 24) return false
        return !isSurface(c)
      })
      if (rows.length < 2) continue
      const starts = rows.map(r => Math.round(startOf(/** @type {HTMLElement} */ (r)))).filter(Number.isFinite)
      const lines = [...new Set(starts)].sort((a, b) => a - b)
      // Two starts within 2px are one line.
      const distinct = lines.filter((x, i) => i === 0 || x - lines[i - 1] > 2)
      if (distinct.length > 1) out.push(`${name(card)} "${words(card)}" rows start at ${distinct.map(x => Math.round(x - card.getBoundingClientRect().left)).join(', ')}px in`)
    }
    return out
  }

  // ---- 3. one control height in a row; corners; type sizes ---------------------------------
  function rowHeights(/** @type {HTMLElement[]} */ all) {
    const out = []
    for (const row of all) {
      const cs = getComputedStyle(row)
      if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
      if (cs.flexDirection.startsWith('column')) continue
      const kids = [...row.children].filter(c => shown(c) && c.matches(CONTROLS))
      if (kids.length < 2) continue
      // One line of them: the ones whose tops sit together.
      /** @type {Map<number, Element[]>} */
      const byLine = new Map()
      for (const k of kids) {
        const r = k.getBoundingClientRect()
        const line = Math.round(r.top + r.height / 2)
        const key = [...byLine.keys()].find(y => Math.abs(y - line) < 8) ?? line
        byLine.set(key, [...(byLine.get(key) ?? []), k])
      }
      for (const line of byLine.values()) {
        if (line.length < 2) continue
        const heights = [...new Set(line.map(k => Math.round(k.getBoundingClientRect().height)))]
        if (heights.length > 1) out.push(`${name(row)}: ${line.map(k => `${words(k) || name(k)} ${Math.round(k.getBoundingClientRect().height)}`).join(' / ')}`)
      }
    }
    return out
  }
  function corners(/** @type {HTMLElement[]} */ all) {
    const seen = new Map()
    for (const el of all) {
      const cs = getComputedStyle(el)
      const radius = parseFloat(cs.borderTopLeftRadius)
      if (!radius) continue
      const r = el.getBoundingClientRect()
      // A circle or a pill is a shape, not a corner.
      if (radius >= Math.min(r.width, r.height) / 2 - 0.5) continue
      const painted = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none'
      if (!painted) continue
      const key = `${Math.round(radius * 10) / 10}px`
      if (!seen.has(key)) seen.set(key, name(el))
    }
    return [...seen.entries()].map(([r, where]) => `${r} (${where})`)
  }
  function typeSizes() {
    const sizes = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue
      const parent = node.parentElement
      if (!parent || !shown(parent)) continue
      const size = `${Math.round(parseFloat(getComputedStyle(parent).fontSize) * 10) / 10}px`
      if (!sizes.has(size)) sizes.set(size, `${name(parent)} "${node.textContent.trim().slice(0, 16)}"`)
    }
    return [...sizes.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([s, where]) => `${s} (${where})`)
  }

  // ---- 4. nothing stretched -------------------------------------------------------------------
  function stretched(/** @type {HTMLElement[]} */ all) {
    const out = []
    const limit = innerWidth >= 1024 ? 400 : Infinity
    for (const el of all) {
      if (!el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), select')) continue
      const r = el.getBoundingClientRect()
      // A narrow dialog's own line - the palette's search, a field across a
      // task's sheet - is the dialog's width, and the dialog is the limit:
      // it is not a field stretched across a page. Narrow is the reading
      // width or less.
      const dialog = el.closest('[role="dialog"]')
      if (dialog && dialog.getBoundingClientRect().width <= 640) continue
      if (r.width > limit) out.push(`${name(el)} "${el.getAttribute('placeholder') || el.getAttribute('aria-label') || ''}" is ${Math.round(r.width)}px wide`)
    }
    return out
  }

  // ---- 5. one row stays one row ------------------------------------------------------------------
  function wrapped(/** @type {HTMLElement[]} */ all) {
    const out = []
    for (const row of all) {
      const cs = getComputedStyle(row)
      if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
      if (cs.flexWrap === 'nowrap' || cs.flexDirection.startsWith('column')) continue
      const kids = [...row.children].filter(c => shown(c) && getComputedStyle(c).position !== 'absolute')
      const controls = kids.filter(c => c.matches(CONTROLS) || c.querySelector(CONTROLS))
      if (controls.length < 2) continue
      const tops = kids.map(k => k.getBoundingClientRect())
      /** @type {number[]} */
      const lines = []
      for (const r of tops) {
        const mid = r.top + r.height / 2
        if (!lines.some(y => Math.abs(y - mid) < Math.max(8, r.height / 2))) lines.push(mid)
      }
      if (lines.length > 1) out.push(`${name(row)} "${words(row)}" wraps onto ${lines.length} lines`)
    }
    return out
  }

  // ---- 7. one frame -----------------------------------------------------------------------------------
  function frame() {
    const main = document.querySelector('main') ?? document.body
    const heading = [...main.querySelectorAll('h1, h2')].find(shown)
    const primary = [...main.querySelectorAll('.btn-primary, button.primary')].find(shown)
    const surface = [...main.querySelectorAll('*')].find(el => el instanceof HTMLElement && shown(el) && isSurface(el))
    const box = (/** @type {Element | undefined} */ el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), width: Math.round(r.width), text: words(el) }
    }
    return { heading: box(heading), primary: box(primary), surface: box(surface) }
  }

  // @ts-ignore
  window.__unify = screen => {
    const all = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('body *')].filter(shown))
    const scroller = document.scrollingElement ?? document.documentElement
    return {
      screen,
      r1: offScale(all),
      r2: leftLines(all),
      r3: [...rowHeights(all)],
      corners: corners(all),
      sizes: typeSizes(),
      r4: stretched(all),
      r5: wrapped(all),
      r6: {
        down: Math.max(0, Math.round(scroller.scrollHeight - innerHeight)),
        sideways: Math.max(0, Math.round(scroller.scrollWidth - innerWidth)),
      },
      r7: frame(),
    }
  }
})()
