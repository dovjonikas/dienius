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

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Offline support is a progressive enhancement: if registration
      // fails for any reason the app still runs, just without it.
    })
  })

  navigator.serviceWorker.addEventListener('controllerchange', createControllerChangeHandler())
}

/**
 * A new service worker taking control mid-session means a fresh deploy
 * landed while the app was already open. Reloading once picks up the new
 * version. Guarded so that if the browser fires this event more than once
 * in a session, the page does not reload in a loop.
 */
export function createControllerChangeHandler(reload: () => void = () => window.location.reload()): () => void {
  let reloaded = false
  return () => {
    if (reloaded) return
    reloaded = true
    reload()
  }
}
