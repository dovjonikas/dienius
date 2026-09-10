import { expect, test } from '@playwright/test'
import { openFreshAt, stampWorkingDay, wednesdayAt } from './app'

/**
 * Nothing fixed to the bottom of the window may cover the tab bar.
 *
 * Below 1024px the rail is a bar along the bottom - the top of a phone is
 * the hardest part of it to reach - and two surfaces are anchored to the
 * same edge. Until v2.17 both sat on top of it: the update notice covered
 * all seven tabs at 390x844 and every one of them failed a hit test, and the
 * undo toast covered four of them for the five seconds it was up. The notice
 * is the worse of the two because it is deliberately ignorable, so somebody
 * who ignores it cannot change tabs at all until they reload.
 *
 * Both are positioned entirely by the stylesheet, so this puts each one's own
 * markup on the page and asks the same question a finger asks: at the centre
 * of each tab, what does the browser say is on top? Driving the real update
 * notice would mean landing a real deploy mid-test, and the real undo toast
 * needs a drag; neither would test anything this does not, because neither
 * component has a position of its own to get wrong.
 */

const SURFACES = [
  { name: 'the update notice', cls: 'update-notice', html: '<p>An update is ready.</p><button type="button">Reload</button>' },
  {
    name: 'the undo toast',
    cls: 'undo-toast',
    html: '<span class="undo-toast-text">Moved to 10:00</span><button type="button" class="undo-toast-button">Undo</button>',
  },
]

/** Every width at which the rail is a bar rather than a column. */
const NARROW = [
  { w: 390, h: 844 },
  { w: 768, h: 900 },
  { w: 1023, h: 800 },
]

for (const size of NARROW) {
  for (const surface of SURFACES) {
    test(`${surface.name} leaves every tab pressable at ${size.w}x${size.h}`, async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h })
      await openFreshAt(page, wednesdayAt(15))
      await stampWorkingDay(page)

      const covered = await page.evaluate(
        ([cls, html]) => {
          const el = document.createElement('div')
          el.className = cls
          el.innerHTML = html
          document.body.appendChild(el)
          // The entry animation starts the notice twelve pixels low and
          // settles in 220ms; measured before that it reports its own
          // arrival as a defect.
          el.getAnimations().forEach(a => a.finish())
          const rail = document.querySelector('nav')
          if (!rail) return ['no rail']
          const out = [...rail.querySelectorAll('button')]
            .filter(b => {
              const r = b.getBoundingClientRect()
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              return !(b === hit || b.contains(hit as Node))
            })
            .map(b => (b.textContent || '').trim() || b.ariaLabel || '?')
          el.remove()
          return out
        },
        [surface.cls, surface.html],
      )

      expect(covered).toEqual([])
    })
  }
}

test('the tab bar is exactly the height the token says it is', async ({ page }) => {
  // --rail-bar-h is what everything anchored to the bottom edge dodges by,
  // so a bar that has quietly grown past it puts them back on top of it.
  await page.setViewportSize({ width: 390, height: 844 })
  await openFreshAt(page, wednesdayAt(15))

  const { railHeight, token } = await page.evaluate(() => {
    const rail = document.querySelector('nav')!
    const declared = getComputedStyle(document.documentElement).getPropertyValue('--rail-bar-h')
    const probe = document.createElement('div')
    probe.style.height = 'var(--rail-bar-h)'
    probe.style.position = 'absolute'
    document.body.appendChild(probe)
    const token = probe.getBoundingClientRect().height
    probe.remove()
    return { railHeight: rail.getBoundingClientRect().height, token, declared }
  })

  expect(Math.round(railHeight)).toBe(Math.round(token))
})

/**
 * And the other side of the breakpoint.
 *
 * v2.17 moved the notice above the tab bar below 1024px and stopped there,
 * which left the same defect where the rail is a column: at 1366x768 it sat
 * at left: 16 over the bottom of a 56px rail, and Settings and the pin were
 * both unpressable. The tests above only ever looked at the narrow widths, so
 * nothing said so - the sweep found it.
 */
const WIDE = [
  { w: 1024, h: 800 },
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
]

for (const size of WIDE) {
  test(`the update notice leaves every rail control pressable at ${size.w}x${size.h}`, async ({ page }) => {
    await page.setViewportSize({ width: size.w, height: size.h })
    await openFreshAt(page, wednesdayAt(15))
    await stampWorkingDay(page)
    // The pointer away from the rail: it opens under a mouse resting in it
    // and draws its labels over the page, which is a flyout doing its job and
    // not a state any screen is found in.
    await page.mouse.move(size.w / 2, size.h / 2)

    const covered = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'update-notice'
      el.innerHTML = '<p>An update is ready.</p><button type="button">Reload</button>'
      document.body.appendChild(el)
      el.getAnimations().forEach(a => a.finish())
      const rail = document.querySelector('nav')
      if (!rail) return ['no rail']
      // Clipped by the rail before it is aimed at. A rail item is laid out
      // at the open width so its label has somewhere to appear, and the
      // closed rail hides the overflow - so the box is 160px wide while
      // only its left 56 is on screen, and its geometric centre is a point
      // nobody can press. Aiming there reported both bottom controls as
      // covered by a notice that does not reach them.
      const railBox = rail.getBoundingClientRect()
      const out = [...rail.querySelectorAll('button')]
        .filter(b => {
          const r = b.getBoundingClientRect()
          const left = Math.max(r.left, railBox.left)
          const right = Math.min(r.right, railBox.right)
          const hit = document.elementFromPoint((left + right) / 2, r.top + r.height / 2)
          return el.contains(hit as Node)
        })
        .map(b => (b.textContent || '').trim() || b.ariaLabel || '?')
      el.remove()
      return out
    })

    expect(covered).toEqual([])
  })
}
