// A measuring pass over whatever screen is open. Not a screenshot read: it
// reports what a person would actually hit - text cut off, a control with
// something on top of it, two pieces of text over each other, a page that
// scrolls sideways, text nobody can read.
//
// Injected into the page by scripts/sweep.mjs. Plain script rather than a
// module because it is added with addScriptTag and has to define globals.
(function () {
  /** @param {Element} el */
  const sig = el => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (el.id ? '#' + el.id : '')
  }

  let clipCache = new Map()
  /** @param {Element} el @returns {Element[]} */
  const clippers = el => {
    let hit = clipCache.get(el)
    if (hit) return hit
    const p = el.parentElement
    if (!p) return (clipCache.set(el, []), [])
    const cs = getComputedStyle(p)
    const up = clippers(p)
    hit = /auto|scroll|hidden|clip/.test(cs.overflowX + cs.overflowY) ? [p, ...up] : up
    clipCache.set(el, hit)
    return hit
  }

  // The rect a person can actually see: the element's own box, clipped by
  // every ancestor that scrolls or hides its overflow, then by the window.
  /** @param {Element} el */
  const seenRect = el => {
    const r = el.getBoundingClientRect()
    const box = { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: 0, height: 0 }
    for (const p of clippers(el)) {
      const pr = p.getBoundingClientRect()
      box.top = Math.max(box.top, pr.top)
      box.left = Math.max(box.left, pr.left)
      box.right = Math.min(box.right, pr.right)
      box.bottom = Math.min(box.bottom, pr.bottom)
    }
    box.top = Math.max(box.top, 0)
    box.left = Math.max(box.left, 0)
    box.right = Math.min(box.right, innerWidth)
    box.bottom = Math.min(box.bottom, innerHeight)
    box.width = box.right - box.left
    box.height = box.bottom - box.top
    return box
  }

  /** @param {Element} el */
  const isScrim = el => {
    if (/scrim|backdrop|overlay/i.test(typeof el.className === 'string' ? el.className : '')) return true
    const r = el.getBoundingClientRect()
    return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && getComputedStyle(el).position === 'fixed'
  }

  // Whether something opaque is painted between the element that was hit and
  // the one behind it - two layers rather than a mess.
  /** @param {Element} hit @param {{ el: Element }} behind */
  const coveredBySurface = (hit, behind) => {
    let el = hit
    while (el && el !== document.body) {
      if (el.contains(behind.el)) return false
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor
      const m = /rgba?\(([^)]+)\)/.exec(bg)
      const a = m ? Number(m[1].split(',')[3] ?? 1) : 0
      if ((bg && bg !== 'transparent' && a > 0.5) || cs.backgroundImage !== 'none') return true
      el = el.parentElement
    }
    return false
  }

  /**
   * How much of this element actually reaches the screen: its own opacity
   * times every ancestor's.
   *
   * The contrast pass read `color` and nothing else, so an element faded to
   * 0.45 was measured as though it were fully painted. That is most of the
   * disabled controls in this app - a `:disabled { opacity: 0.4 }` roughly
   * halves the contrast of whatever is inside it - and every one of them
   * came back clean. The replan door's "Morning gone" was read off a phone
   * screenshot by eye at 2.4:1 while the sweep called the same screen
   * spotless.
   *
   * @param {Element} el @returns {number}
   */
  const paintedShare = el => {
    let share = 1
    /** @type {Element | null} */
    let at = el
    while (at && at !== document.body) {
      share *= Number(getComputedStyle(at).opacity)
      at = at.parentElement
    }
    return share
  }

  /** @param {Element} el */
  const visible = el => {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    if (el.closest('.visually-hidden')) return false
    const r = seenRect(el)
    return r.width > 1 && r.height > 1
  }

  /** @param {Element} el */
  /**
   * The string this element paints itself, if any.
   *
   * A field's text is its value or its placeholder, not a child node - it
   * has no children at all - so an input was invisible to every pass that
   * starts here, contrast included. That is how the evening time in
   * Settings came to be painted pure black on a dark surface for a whole
   * version without anything noticing: the colour a field shows is the one
   * thing in this app nobody can read from the DOM by walking text.
   */
  const ownText = el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'range' || el.type === 'color' || el.type === 'file') return ''
      return (el.value || el.placeholder || '').trim()
    }
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim()
    return ''
  }

  /**
   * A computed colour as [r, g, b, a] on 0-255. Chrome says `rgb()` for
   * most, and `color(srgb r g b / a)` on 0-1 for anything that came out
   * of a color-mix() - the washes over a surface, and a ring's gap drawn
   * in one - which used to read as no colour at all here, so a wash was
   * invisible to the contrast pass and a mixed gap was the wrong layer.
   * @param {string} c @returns {number[] | null}
   */
  function parse(c) {
    const srgb = /color[(]srgb ([0-9.]+) ([0-9.]+) ([0-9.]+)(?: *[/] *([0-9.]+))?[)]/.exec(c)
    if (srgb) return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255, srgb[4] === undefined ? 1 : +srgb[4]]
    const m = /rgba?[(]([^)]+)[)]/.exec(c)
    if (!m) return null
    const parts = m[1].split(/[, /]+/).filter(Boolean).map(Number)
    return [parts[0], parts[1], parts[2], parts[3] === undefined ? 1 : parts[3]]
  }

  /** @param {number[]} fg @param {number[]} bg @returns {number[]} */
  function blend(fg, bg) {
    const a = fg[3]
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]
  }

  /** @param {Element} el @returns {number[]} */
  function surfaceUnder(el) {
    const stack = []
    let p = el
    while (p && p !== document.documentElement) {
      const c = parse(getComputedStyle(p).backgroundColor)
      if (c && c[3] > 0) {
        stack.push(c)
        if (c[3] >= 0.999) break
      }
      p = p.parentElement
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 1]
    let out = root[3] >= 0.999 ? root : [255, 255, 255, 1]
    for (let i = stack.length - 1; i >= 0; i--) out = blend(stack[i], out)
    return out
  }

  /** @param {number[]} rgb */
  function luminance(rgb) {
    const f = v => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
  }

  /** @param {number[]} a @param {number[]} b */
  function contrast(a, b) {
    const la = luminance(a) + 0.05
    const lb = luminance(b) + 0.05
    return la > lb ? la / lb : lb / la
  }

  // A chosen swatch's ring is a box-shadow, so it is drawn outside the box
  // and a scroller between it and the page clips it; and its gap is drawn
  // in the ground's colour, which is only right when the ground under it is
  // the one the ring assumed. Both were real once: the first dot under
  // quick-add lost the left of its ring to the task column's scroller, and
  // the gap was the card colour on rows that sit on the page.
  const RINGED = '.category-swatch.selected, .accent-swatch.selected, .swatch.selected, .library-color.is-on'
  /** @returns {{ kind: 'cut' | 'gap', sel: string, detail: string }[]} */
  /**
   * A chosen control that looks exactly like the ones beside it.
   *
   * The owner has reported this shape twice, in the two places it happened:
   * the category swatch whose ring was clipped, and the week template
   * editor's "Add to" row, where all four chips carried the same border
   * because a generic rule for buttons in that row outranked
   * `.chip.selected`. Both times `aria-pressed` was correct and the paint
   * was not, so a screen reader knew which day the block was about to land
   * on and a person did not.
   *
   * Nothing measured that. `aria-pressed` is a string in the DOM and a test
   * asserting it passes whether or not anything is drawn; the contrast pass
   * reads one element at a time and has no opinion about two of them looking
   * alike. So: within a group of siblings that carry the same state
   * attribute, where at least one is set and at least one is not, the set
   * one has to differ from an unset one in something somebody can see.
   *
   * Background, border, colour, shadow, outline, weight. Any one of them is
   * enough - this is not an opinion about how a selection should look, only
   * that it should look like something.
   */
  function chosenDefects() {
    const out = []
    const seen = new Set()
    for (const attr of ['aria-pressed', 'aria-checked', 'aria-selected']) {
      for (const el of document.querySelectorAll('[' + attr + '=true]')) {
        if (!visible(el) || seen.has(el)) continue
        const parent = el.parentElement
        if (!parent) continue
        const family = [...parent.children].filter(
          k => k !== el && k.hasAttribute(attr) && k.getAttribute(attr) === 'false' && visible(k),
        )
        if (family.length === 0) continue
        seen.add(el)
        const mine = look(el)
        const twin = family.find(k => same(mine, look(k)))
        if (twin) {
          out.push({
            sel: sig(el),
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28),
            like: (twin.textContent || twin.getAttribute('aria-label') || '').trim().slice(0, 28),
            attr,
          })
        }
      }
    }
    return out
  }

  /** The six things a selection is allowed to be drawn with. */
  function look(el) {
    const s = getComputedStyle(el)
    return [s.backgroundColor, s.borderColor, s.color, s.boxShadow, s.outlineStyle + ' ' + s.outlineColor, s.fontWeight].join('|')
  }

  /** @param {string} a @param {string} b */
  function same(a, b) {
    return a === b
  }

  function ringDefects() {
    const out = []
    for (const el of document.querySelectorAll(RINGED)) {
      if (!visible(el)) continue
      const shadow = getComputedStyle(el).boxShadow
      if (!shadow || shadow === 'none') continue
      // Each layer reaches offset + blur + spread past the box; the ring is the farthest.
      const layers = []
      const re = /((?:rgba?|color)[(][^)]+[)])[ ]+(-?[0-9.]+)px[ ]+(-?[0-9.]+)px[ ]+(-?[0-9.]+)px[ ]+(-?[0-9.]+)px/g
      let m
      while ((m = re.exec(shadow))) layers.push({ color: m[1], reach: Math.max(Math.abs(+m[2]), Math.abs(+m[3])) + +m[4] + +m[5] })
      if (layers.length === 0) continue
      const reach = Math.max(...layers.map(l => l.reach))
      const r = el.getBoundingClientRect()
      const ring = { left: r.left - reach, top: r.top - reach, right: r.right + reach, bottom: r.bottom + reach }
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
        const b = p.getBoundingClientRect()
        const left = b.left + p.clientLeft
        const top = b.top + p.clientTop
        const sides = []
        if (ring.left < left - 1) sides.push('left')
        if (ring.top < top - 1) sides.push('top')
        if (ring.right > left + p.clientWidth + 1) sides.push('right')
        if (ring.bottom > top + p.clientHeight + 1) sides.push('bottom')
        if (sides.length) {
          out.push({ kind: 'cut', sel: sig(el), detail: sig(el) + ' ' + sides.join('+') + ' by ' + sig(p) })
          break
        }
      }
      // The innermost layer is the gap, and it has to be what is painted beside the swatch.
      const gap = parse(layers[0].color)
      const ground = surfaceUnder(el.parentElement)
      if (gap && gap.slice(0, 3).some((v, i) => Math.abs(v - ground[i]) > 2))
        out.push({ kind: 'gap', sel: sig(el), detail: sig(el) + ' gap ' + layers[0].color + ' on rgb(' + ground.slice(0, 3).map(Math.round).join(', ') + ')' })
    }
    return out
  }

  /**
   * A child of a row that centres its children, which is nevertheless not
   * centred in it.
   *
   * The owner's screenshot of the week editor's note header found this: a
   * Close eleven pixels above the two buttons beside it, because
   * `.setting-quiet` carries `align-self: flex-start` for the column it was
   * written for, and `align-self` on a child beats `align-items` on its row.
   * Nothing in this repo could see it - jsdom has no layout, and the shape
   * is not text cut off or a control covered, so the sweep walked past it at
   * every size for six versions.
   *
   * Measured against the row's *content* box: a header with sixteen pixels
   * of padding above and eight below centres its children in what is left,
   * and comparing with the border box calls every one of them off centre.
   *
   * A wrapping row is skipped: on a second line a child is centred in its
   * own line, not in the row, and every one of them reads as a finding.
   */
  const offCentreDefects = () => {
    const out = []
    for (const row of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(row)
      if (!/flex/.test(cs.display) || cs.flexDirection.startsWith('column')) continue
      if (cs.alignItems !== 'center' || cs.flexWrap === 'wrap') continue
      const rr = row.getBoundingClientRect()
      if (rr.height === 0 || rr.height > 120) continue
      const top = rr.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth)
      const bottom = rr.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth)
      const centre = (top + bottom) / 2
      const kids = [...row.children].filter(c => {
        const r = c.getBoundingClientRect()
        return r.height > 0 && r.width > 0 && getComputedStyle(c).position !== 'absolute'
      })
      if (kids.length < 2) continue
      for (const c of kids) {
        // Not a transformed one. A chevron here is two borders of a square
        // turned 45 degrees, and the translate inside that rotation is what
        // pulls the ink back to the middle of a box that is now bigger than
        // it - so its rect is 11px where its box is 8, and off centre by
        // exactly the translate. This reported sixteen of them on the clock
        // panels, which is the drawing technique and not a defect. A
        // transform is also how CONVENTIONS 24 allows a state to be drawn.
        if (getComputedStyle(c).transform !== 'none') continue
        const r = c.getBoundingClientRect()
        const off = r.top + r.height / 2 - centre
        if (Math.abs(off) <= 1.5) continue
        out.push({
          sel: sig(row),
          child: sig(c),
          text: (c.textContent || '').trim().slice(0, 24),
          off: Math.round(off),
        })
      }
    }
    return out
  }

  /**
   * Two controls in one row, drawn as boxes, at different heights.
   *
   * `.block-add-marks` was fixed for exactly this in v2.9 - "everything here
   * was between 28px and 44px, which put three baselines in one row" - and
   * the fix was written for that one row rather than found everywhere. The
   * week editor's note header still had a 44px toggle beside a 38px button.
   *
   * Only boxed controls are compared. A quiet word - a text button with no
   * background and no border - is deliberately the height of its own text,
   * and holding it to the pill beside it would report a shape the app means.
   */
  const mismatchedDefects = () => {
    const boxed = el => {
      if (el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'button') return false
      if (!(el.textContent || '').trim()) return false
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor
      const painted = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      return painted || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0
    }
    const out = []
    for (const row of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(row)
      if (!/flex/.test(cs.display) || cs.flexDirection.startsWith('column')) continue
      const kids = [...row.children].filter(c => {
        const r = c.getBoundingClientRect()
        return r.height > 0 && r.width > 0 && boxed(c)
      })
      if (kids.length < 2) continue
      const heights = kids.map(c => Math.round(c.getBoundingClientRect().height))
      const low = Math.min(...heights)
      const high = Math.max(...heights)
      if (high - low <= 2) continue
      out.push({
        sel: sig(row),
        detail: kids.map((c, i) => '"' + (c.textContent || '').trim().slice(0, 14) + '" ' + heights[i] + 'px').join(', '),
      })
    }
    return out
  }

  /**
   * A scroller whose content is wider than it is.
   *
   * "Nothing scrolls horizontally, ever" - CONVENTIONS 4 - and the check
   * written beside that sentence is `documentElement.scrollWidth >
   * clientWidth`, which only sees it when the *page* is the thing that
   * scrolls. A scroller inside the page absorbs the overflow instead and the
   * document stays exactly as wide as the window, so the rule was unenforced
   * everywhere it is most likely to break.
   *
   * Found by the v2.17 hunt's hundred-task day: one two-hundred-character
   * title with no spaces in it measured 2014px in a 310px column and gave the
   * task list 1753px of sideways scroll, painting over everything to its
   * right. `hScroll` read zero throughout.
   *
   * **Only when one thing in it does not fit**, which is what tells a defect
   * from a design. A strip that is a row of things - the week editor's seven
   * columns at 390px, Settings' section nav - scrolls sideways on purpose and
   * every child of it fits: 104px in 314px, 105px in 358px. A defect is a
   * single child wider than the box it is in, which is the shape a title with
   * nothing to break at makes and the shape a strip never makes. Reported
   * without that clause, the two known strips were six findings a run and the
   * one real defect would have sat among them.
   *
   * Reports what is forcing it wide as well as which scroller, because the
   * scroller is never the thing to fix.
   */
  const sidewaysDefects = () => {
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (!/auto|scroll/.test(cs.overflowX)) continue
      const over = el.scrollWidth - el.clientWidth
      if (over <= 1) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const widest = [...el.querySelectorAll('*')]
        .map(c => ({ el: c, w: c.getBoundingClientRect().width }))
        .sort((a, b) => b.w - a.w)[0]
      if (!widest || widest.w <= el.clientWidth + 1) continue
      out.push({
        sel: sig(el),
        over,
        detail: `${sig(widest.el)} is ${Math.round(widest.w)}px in ${el.clientWidth}px "${(widest.el.textContent || '').trim().slice(0, 24)}"`,
      })
    }
    return out
  }

  /** @param {string} label */
  window.__audit = function audit(label) {
    clipCache = new Map()
    const de = document.documentElement
    const out = {
      label,
      w: innerWidth,
      h: innerHeight,
      theme: de.dataset.theme || 'auto',
      hScroll: Math.max(0, de.scrollWidth - de.clientWidth),
      vScroll: Math.max(0, de.scrollHeight - de.clientHeight),
      clipped: [],
      covered: [],
      overlap: [],
      offscreen: [],
      faint: [],
      chosen: [],
      layer: null,
    }

    const all = [...document.querySelectorAll('body *')].filter(visible)

    for (const el of all) {
      const t = ownText(el)
      if (!t) continue
      const cs = getComputedStyle(el)
      if (cs.textOverflow === 'ellipsis') continue
      if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue
      const overX = el.scrollWidth - el.clientWidth
      const overY = el.scrollHeight - el.clientHeight
      if (overX <= 1 && overY <= 1) continue
      if (cs.overflow === 'visible') continue
      out.clipped.push({ sel: sig(el), overX, overY, text: t.slice(0, 50) })
    }

    // While a sheet is open, everything behind it is meant to be behind it.
    // A popover is the same for as long as it is up - the template's colour
    // panel sits over the day-type buttons, which is where a popover goes.
    const layer =
      document.querySelector('[role="dialog"], .replan, .task-detail-panel, .task-detail-sheet, .scratch-overlay, .task-gap-offers-panel, .task-actions-sheet, .swatch-picker-panel') || null
    out.layer = layer ? sig(layer) : null

    for (const b of document.querySelectorAll('button, [role="button"], a[href], input, select, textarea')) {
      if (!visible(b)) continue
      if (b.closest('.visually-hidden')) continue
      if (layer && !layer.contains(b)) continue
      const r = seenRect(b)
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (!hit) continue
      if (hit === b || b.contains(hit) || hit.contains(b)) continue
      if (hit.closest('label') && hit.closest('label').contains(b)) continue
      if (isScrim(hit)) continue
      // The navigation is chrome and is always over the page: a rail down the
      // side on a desktop, a bar along the bottom on a phone. A control
      // passing under it while the page scrolls is what a fixed bar is, not a
      // defect - and the layout already reserves the room it needs, so
      // nothing is under it at rest. The exemption is for the covering
      // element only: a control *inside* the rail that something else is over
      // is still a finding.
      if (hit.closest('.nav-rail')) continue
      out.covered.push({ sel: sig(b), by: sig(hit), t: (b.textContent || b.ariaLabel || '').trim().slice(0, 30) })
    }

    const leaves = []
    for (const el of all) {
      const t = ownText(el)
      if (!t) continue
      const r = seenRect(el)
      if (r.width <= 8 || r.height <= 2) continue
      leaves.push({ el, r, t })
    }
    leaves.sort((x, y) => x.r.top - y.r.top)
    for (let i = 0; i < leaves.length; i++) {
      const a = leaves[i]
      for (let j = i + 1; j < leaves.length; j++) {
        const b = leaves[j]
        if (b.r.top >= a.r.bottom - 2) break
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (w <= 2 || h <= 2) continue
        const share = (w * h) / Math.min(a.r.width * a.r.height, b.r.width * b.r.height)
        if (share < 0.5) continue
        const x = (Math.max(a.r.left, b.r.left) + Math.min(a.r.right, b.r.right)) / 2
        const y = (Math.max(a.r.top, b.r.top) + Math.min(a.r.bottom, b.r.bottom)) / 2
        const mid = document.elementFromPoint(x, y)
        if (!mid) continue
        const front = a.el.contains(mid) || a.el === mid ? a : b.el.contains(mid) || b.el === mid ? b : null
        if (!front) continue
        const behind = front === a ? b : a
        if (coveredBySurface(mid, behind)) continue
        out.overlap.push({ a: sig(a.el), b: sig(b.el), share: +share.toFixed(2), ta: a.t.slice(0, 25), tb: b.t.slice(0, 25) })
      }
    }

    for (const el of all) {
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.right <= innerWidth + 1) continue
      let p = el.parentElement
      let scrolled = false
      while (p && p !== document.body) {
        if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX)) { scrolled = true; break }
        p = p.parentElement
      }
      if (scrolled) continue
      out.offscreen.push({ sel: sig(el), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 40) })
    }

    // Text nobody can read. AA: 4.5:1 body, 3:1 large.
    for (const el of all) {
      const t = ownText(el)
      if (!t) continue
      const cs = getComputedStyle(el)
      const fg = parse(cs.color)
      if (!fg) continue
      // Fading an element fades its text with it, and the text is what has
      // to be read. An element's own background fades into what is under it
      // by the same share, but a control's background is a hairline lighter
      // than the surface it sits on, so measuring against the surface is
      // both simpler and the harder test.
      const share = paintedShare(el)
      // Pushed back on purpose, however it is said: faded, or disabled. The
      // two are the same intention and get the same floor - what would be
      // wrong is a bar that moves depending on whether a control was dimmed
      // with an opacity or with a colour.
      const faded = share < 0.999 || el.matches(':disabled, :disabled *')
      fg[3] *= share
      if (fg[3] < 0.05) continue
      const bg = surfaceUnder(el)
      if (!bg) continue
      const size = parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      const large = size >= 24 || (bold && size >= 18.66)
      const ratio = contrast(blend(fg, bg), bg)
      // Text somebody has to read: AA, 4.5 or 3 when it is large.
      //
      // Text this app has deliberately pushed back - a day from the month
      // either side, a control that cannot be pressed yet - is held to 3
      // instead. Fading is how a hierarchy is drawn here and holding a
      // deliberate whisper to the same bar as the sentence it sits under
      // would flatten it; 3:1 is the line below which it stops being a
      // whisper and starts being a smudge. See CONVENTIONS section 22.
      const need = faded ? 3 : large ? 3 : 4.5
      if (ratio >= need) continue
      out.faint.push({ sel: sig(el), text: t.slice(0, 40), ratio: +ratio.toFixed(2), need, fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')' })
    }

    out.rings = ringDefects()
    out.chosen = chosenDefects()
    out.offCentre = offCentreDefects()
    out.sideways = sidewaysDefects()
    out.mismatched = mismatchedDefects()
    return out
  }

  /** @param {string} label */
  window.__brief = function brief(label) {
    const a = window.__audit(label)
    return { label: a.label, size: a.w + 'x' + a.h, theme: a.theme, hScroll: a.hScroll, vScroll: a.vScroll, clipped: a.clipped.length, covered: a.covered.length, overlap: a.overlap.length, offscreen: a.offscreen.length, faint: a.faint.length, ringCut: a.rings.filter(r => r.kind === 'cut').length, ringGap: a.rings.filter(r => r.kind === 'gap').length, chosen: a.chosen.length, offCentre: a.offCentre.length, mismatched: a.mismatched.length, sideways: a.sideways.length }
  }

  /** @param {string} tab */
  window.__go = async function go(tab) {
    const b = [...document.querySelectorAll('nav button')].find(x => x.textContent.trim() === tab)
    if (!b) return 'no tab ' + tab
    b.click()
    await new Promise(r => setTimeout(r, 400))
    return 'on ' + tab
  }
})()
