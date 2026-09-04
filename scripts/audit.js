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

  /** @param {Element} el */
  const visible = el => {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    if (el.closest('.visually-hidden')) return false
    const r = seenRect(el)
    return r.width > 1 && r.height > 1
  }

  /** @param {Element} el */
  const ownText = el => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return n.nodeValue.trim()
    return ''
  }

  /** @param {string} c @returns {number[] | null} */
  function parse(c) {
    const m = /rgba?\(([^)]+)\)/.exec(c)
    if (!m) return null
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
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
    const layer =
      document.querySelector('[role="dialog"], .replan, .task-detail-panel, .task-detail-sheet, .scratch-overlay, .task-gap-offers-panel, .task-actions-sheet') || null
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
      if (!fg || fg[3] < 0.05) continue
      const bg = surfaceUnder(el)
      if (!bg) continue
      const size = parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      const large = size >= 24 || (bold && size >= 18.66)
      const ratio = contrast(blend(fg, bg), bg)
      const need = large ? 3 : 4.5
      if (ratio >= need) continue
      out.faint.push({ sel: sig(el), text: t.slice(0, 40), ratio: +ratio.toFixed(2), need, fg: cs.color, bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')' })
    }

    return out
  }

  /** @param {string} label */
  window.__brief = function brief(label) {
    const a = window.__audit(label)
    return { label: a.label, size: a.w + 'x' + a.h, theme: a.theme, hScroll: a.hScroll, vScroll: a.vScroll, clipped: a.clipped.length, covered: a.covered.length, overlap: a.overlap.length, offscreen: a.offscreen.length, faint: a.faint.length }
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
