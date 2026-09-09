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
