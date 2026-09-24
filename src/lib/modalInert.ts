/**
 * The page behind a sheet is out of reach while the sheet is open.
 *
 * A sheet that covers the page - a task's detail, replan and the low day,
 * the palette, Scratch, the journal, North after sleep, Focus, the shortcuts
 * - is marked `aria-modal`, which tells a screen reader that the page behind
 * it is not there. A keyboard was never told: Tab ran off the end of a sheet
 * into the page under its scrim, and a walk from the top met the whole day
 * before the sheet (keys.mjs, the freeze's point 4). So while a sheet is
 * open, everything outside it is `inert` - not focusable, not pressable, not
 * read - except the sheet's own scrim, which is how a press beside the sheet
 * closes it.
 *
 * A panel of the header is not a sheet. It covers nothing, it closes on any
 * press outside it, and the page stays in reach while it is open.
 *
 * The tour stands over every sheet (`data-over-sheets`): it asks for a
 * task's sheet to be opened and then for Next on its own card, and a card
 * behind the sheet it asked for could not be pressed.
 *
 * Only what this made inert is let go when the sheet closes: an element the
 * page had made inert on its own stays so.
 */
const MARK = 'data-inert-by-sheet'

/** The sheet on top: the last one in the document, which is the one drawn last. */
function topSheet(root: Document): Element | null {
  const sheets = [...root.querySelectorAll('[aria-modal="true"]')].filter(el => !el.closest('.app-header'))
  return sheets.length > 0 ? sheets[sheets.length - 1] : null
}

function isScrim(el: Element): boolean {
  return typeof el.className === 'string' && /(^|\s)[\w-]*scrim(\s|$)/.test(el.className)
}

function apply(root: Document): void {
  const sheet = topSheet(root)
  const wanted = new Set<Element>()
  for (let node: Element | null = sheet; node && node !== root.body && node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || isScrim(sibling) || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(sibling.tagName)) continue
      if (sibling.matches('[data-over-sheets]') || sibling.querySelector('[data-over-sheets]')) continue
      wanted.add(sibling)
    }
  }
  for (const el of root.querySelectorAll(`[${MARK}]`)) {
    if (wanted.has(el)) continue
    el.removeAttribute('inert')
    el.removeAttribute(MARK)
  }
  for (const el of wanted) {
    if (el.hasAttribute('inert')) continue
    el.setAttribute('inert', '')
    el.setAttribute(MARK, '')
  }
}

/** Keeps the page behind whichever sheet is open out of reach, until the returned function is called. */
export function watchModals(root: Document = document): () => void {
  apply(root)
  // Our own attributes are not watched, so marking the page does not wake
  // this again; a sheet coming or going, anywhere in the page, does.
  const observer = new MutationObserver(() => apply(root))
  observer.observe(root.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal'] })
  return () => {
    observer.disconnect()
    for (const el of root.querySelectorAll(`[${MARK}]`)) {
      el.removeAttribute('inert')
      el.removeAttribute(MARK)
    }
  }
}
