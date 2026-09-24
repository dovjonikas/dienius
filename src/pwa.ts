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
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(askForUpdatesOnReturn, () => {
      // Offline support is a progressive enhancement: if registration
      // fails for any reason the app still runs, just without it.
    })
  })

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    createControllerChangeHandler(notifyUpdateReady, hadController, servesThisPage),
  )
}

/**
 * A page left open asks for a newer version each time it comes back into
 * view - from another app on a phone, another tab on a desktop.
 *
 * A browser looks for a new worker when a page is opened, and a phone keeps
 * an installed app alive in the background for days without opening it
 * again: until the freeze, a deploy reached such an app only when the phone
 * happened to close it. Asking on return means the new version is ready
 * within a second of being looked at, and says so the usual quiet way.
 * Offline, the question fails and is let go; it is asked again next time.
 */
export function askForUpdatesOnReturn(
  registration: Pick<ServiceWorkerRegistration, 'update'>,
  doc: Document = document,
): () => void {
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') return
    registration.update().catch(() => {})
  }
  doc.addEventListener('visibilitychange', onVisibility)
  return () => doc.removeEventListener('visibilitychange', onVisibility)
}

/** What build a page is, as far as a page can tell: the script and the stylesheets it names. */
function buildOf(doc: Document): string {
  return [...doc.querySelectorAll('script[type="module"][src], link[rel="stylesheet"][href]')]
    .map(el => el.getAttribute('src') ?? el.getAttribute('href') ?? '')
    .sort()
    .join(' ')
}

/**
 * Whether the version now in charge serves the very page that is running.
 *
 * The app opened after a deploy is already the new version - the page is
 * fetched from the network first, and the scripts it names are the new
 * ones - and the new worker takes charge a moment later. That takeover is a
 * controllerchange like any other, and until the freeze it raised "An update
 * is ready" over a page that had nothing to reload into, after every deploy.
 * The page the new worker serves is read from its own cache and compared by
 * the files it names; a page that cannot be read is taken to be another
 * version, so a real update is never swallowed.
 */
export async function servesThisPage(
  served: () => Promise<string> = () => fetch(`${import.meta.env.BASE_URL}index.html`).then(r => r.text()),
  doc: Document = document,
): Promise<boolean> {
  try {
    return buildOf(new DOMParser().parseFromString(await served(), 'text/html')) === buildOf(doc)
  } catch {
    return false
  }
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
 * happen while they are mid-edit. Guarded three times: `hadController`
 * skips the very first claim a browser ever sees (a fresh install has
 * nothing stale to announce), `isCurrent` skips a takeover by the very
 * build the page already is (the app opened after a deploy - see
 * servesThisPage), and `notified` makes sure the flag is only ever raised
 * once per page life even if the browser fires the event more than once.
 */
export function createControllerChangeHandler(
  onReady: () => void = notifyUpdateReady,
  hadController = true,
  isCurrent?: () => Promise<boolean>,
): () => void {
  let sawController = hadController
  let notified = false
  const announce = () => {
    if (notified) return
    notified = true
    onReady()
  }
  return () => {
    if (!sawController) {
      sawController = true
      return
    }
    if (notified) return
    if (!isCurrent) {
      announce()
      return
    }
    // The page may already be the version now in charge - see
    // servesThisPage. Then there is nothing to announce, and the next
    // takeover is asked again.
    void isCurrent().then(current => {
      if (!current) announce()
    })
  }
}
