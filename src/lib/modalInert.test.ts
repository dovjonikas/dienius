import { afterEach, beforeEach, expect, test } from 'vitest'
import { watchModals } from './modalInert'

/**
 * The page behind a sheet is out of reach while the sheet is open - see
 * modalInert.ts. Found by the keyboard pass in the freeze: Tab from a
 * sheet's last button went on into the page under its scrim.
 */

let stop: () => void = () => {}

beforeEach(() => {
  document.body.innerHTML = `
    <div id="root">
      <div class="app">
        <header class="app-header"><button id="menu">Menu</button><div id="header-slot"></div></header>
        <nav id="rail"><button>Today</button></nav>
        <main id="main"><button>A task</button><div id="in-main"></div></main>
        <div id="sheet-slot"></div>
      </div>
    </div>
    <div id="tips"></div>`
})

afterEach(() => {
  stop()
  document.body.innerHTML = ''
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const inert = (id: string) => document.getElementById(id)!.closest('[inert]') !== null

function sheet(into: string, html = '<button>Close</button>', modal = true): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'dialog')
  if (modal) el.setAttribute('aria-modal', 'true')
  el.innerHTML = html
  document.getElementById(into)!.appendChild(el)
  return el
}

test('while a sheet is open everything outside it is inert, and nothing is once it closes', async () => {
  stop = watchModals()
  const open = sheet('sheet-slot')
  await flush()
  for (const id of ['menu', 'rail', 'main', 'tips']) expect(inert(id), id).toBe(true)
  expect(open.closest('[inert]')).toBeNull()

  open.remove()
  await flush()
  expect(document.querySelectorAll('[inert]')).toHaveLength(0)
})

test('a sheet drawn inside the page leaves only its own way up live', async () => {
  stop = watchModals()
  const open = sheet('in-main')
  await flush()
  expect(open.closest('[inert]')).toBeNull()
  expect(inert('rail')).toBe(true)
  expect(document.querySelector('#main > button')!.closest('[inert]')).not.toBeNull()
})

test("a sheet's own scrim beside it stays live, so a press outside the sheet still closes it", async () => {
  stop = watchModals()
  const scrim = document.createElement('button')
  scrim.className = 'task-actions-scrim'
  document.getElementById('sheet-slot')!.appendChild(scrim)
  sheet('sheet-slot')
  await flush()
  expect(scrim.hasAttribute('inert')).toBe(false)
  expect(inert('main')).toBe(true)
})

test("a header's panel is not a sheet: the page stays in reach", async () => {
  stop = watchModals()
  sheet('header-slot')
  await flush()
  expect(document.querySelectorAll('[inert]')).toHaveLength(0)
})

test('a dialog that is not modal leaves the page alone', async () => {
  stop = watchModals()
  sheet('sheet-slot', '<button>Next</button>', false)
  await flush()
  expect(document.querySelectorAll('[inert]')).toHaveLength(0)
})

test('with a sheet over a sheet, the one on top is the one left live', async () => {
  stop = watchModals()
  const under = sheet('sheet-slot', '<button>Under</button><div id="inner-slot"></div>')
  const over = sheet('inner-slot', '<button>Over</button>')
  await flush()
  expect(over.closest('[inert]')).toBeNull()
  expect(under.querySelector('button')!.closest('[inert]')).not.toBeNull()
})

test('the tour stands over a sheet: its card stays in reach while a sheet it asked for is open', async () => {
  const tour = document.createElement('div')
  tour.setAttribute('data-over-sheets', '')
  tour.innerHTML = '<button id="tour-next">Next</button>'
  document.querySelector('.app')!.appendChild(tour)
  stop = watchModals()
  sheet('in-main')
  await flush()
  expect(inert('tour-next')).toBe(false)
  expect(inert('rail')).toBe(true)
})

test('what the page had made inert on its own stays so when the sheet goes', async () => {
  document.getElementById('rail')!.setAttribute('inert', '')
  stop = watchModals()
  const open = sheet('sheet-slot')
  await flush()
  open.remove()
  await flush()
  expect(document.getElementById('rail')!.hasAttribute('inert')).toBe(true)
  expect(document.getElementById('main')!.hasAttribute('inert')).toBe(false)
})
