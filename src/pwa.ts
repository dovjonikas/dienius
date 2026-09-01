/**
 * Registers the service worker in production builds only, so the dev
 * server never has a worker competing with Vite's own module reloading.
 * `import.meta.env.BASE_URL` already resolves to the deployed subpath
 * (`/dienius/` on GitHub Pages), so the registration path stays correct
 * without hardcoding it here too.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  // A controller already present when this module runs means a service
  // worker from an earlier visit is already in charge of this page - so
  // the next controllerchange is a real update taking over. No controller
  // yet means this is the very first time this browser has registered the
  // worker at all (a fresh install, or site data was cleared): the claim
  // that follows is that worker taking charge for the first time, not an
  // update to announce.
  const hadController = navigator.serviceWorker.controller !== null

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a progressive enhancement: if registration
      // fails for any reason the app still runs, just without it.
    })
  })

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    createControllerChangeHandler(notifyUpdateReady, hadController),
  )
}

type UpdateListener = () => void

const updateListeners = new Set<UpdateListener>()

/**
 * Subscribes to "a new build has taken over in the background and is
 * ready to show." Returns an unsubscribe function. This is a plain
 * listener set rather than a React context so pwa.ts keeps no dependency
 * on React and stays unit-testable in isolation the way it already was -
 * see UpdateNotice.tsx for the one thing that currently listens.
 */
export function onUpdateReady(listener: UpdateListener): () => void {
  updateListeners.add(listener)
  return () => updateListeners.delete(listener)
}

function notifyUpdateReady(): void {
  updateListeners.forEach(listener => listener())
}

/**
 * A new service worker taking control mid-session means a fresh deploy
 * landed while the app was already open. This used to reload the page
 * immediately; now it only raises the "update ready" flag that
 * UpdateNotice renders as a quiet, dismissible-by-ignoring notice - the
 * reload itself is a person's own choice from there, so it can never
 * happen while they are mid-edit. Guarded twice: `hadController` skips
 * the very first claim a browser ever sees (a fresh install has nothing
 * stale to announce), and `notified` makes sure the flag is only ever
 * raised once per page life even if the browser fires the event more than
 * once.
 */
export function createControllerChangeHandler(
  onReady: () => void = notifyUpdateReady,
  hadController = true,
): () => void {
  let sawController = hadController
  let notified = false
  return () => {
    if (!sawController) {
      sawController = true
      return
    }
    if (notified) return
    notified = true
    onReady()
  }
}
