/**
 * The install prompt, held until somebody asks for it.
 *
 * Chrome and the Chromium-based browsers fire `beforeinstallprompt` when a
 * site qualifies for installation, and the event is only usable if its
 * default is prevented and it is kept - the browser will not hand it over
 * twice. Everything here exists to hold exactly one of those and to answer
 * two questions honestly: can this browser install right now, and is it
 * already installed.
 *
 * iOS Safari fires nothing at all - Apple has no programmatic install, only
 * Share -> Add to Home Screen. So `canInstall()` being false is not the same
 * as "this cannot be installed", and Settings says so in words rather than
 * hiding the row: the one browser this app's owner actually uses is the one
 * that needs the sentence, not the button.
 *
 * Deliberately framework-free, the same way pwa.ts is, so it can be tested
 * without a DOM tree and used from anywhere.
 */

/** The shape Chromium fires. Not in lib.dom, so it is named here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach(fn => fn())
}

/** Starts listening. Safe to call more than once; only the first arms it. */
export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return
  if (watching) return
  watching = new AbortController()
  const { signal } = watching

  window.addEventListener(
    'beforeinstallprompt',
    event => {
      event.preventDefault()
      deferred = event as BeforeInstallPromptEvent
      notify()
    },
    { signal },
  )
  // Fired once the install actually completes, on the page that triggered it
  // and on any other open copy. Dropping the held event here is what stops
  // Settings offering to install something that already is.
  window.addEventListener(
    'appinstalled',
    () => {
      deferred = null
      notify()
    },
    { signal },
  )
}

/**
 * The controller for the two window listeners, held so `resetInstallForTests`
 * can genuinely undo them. A flag alone flipped back to false and left the
 * listeners attached, so a second `watchInstallPrompt` added a second pair -
 * which never happens in the app, where it is called once, and happens in
 * every test after the first.
 */
let watching: AbortController | null = null

export function canInstall(): boolean {
  return deferred !== null
}

/**
 * True when the page is running as an installed app rather than in a tab.
 * `display-mode: standalone` covers Chromium and installed iOS alike;
 * `navigator.standalone` is the older iOS-only signal, still the only one
 * some versions report. Both are wrapped, because matchMedia can be missing
 * in the odd environment this app already guards against elsewhere.
 */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
  } catch {
    // Fall through to the iOS signal below.
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Shows the browser's own install dialog. Returns what the person chose, or
 * 'unavailable' when there was no held event to show - which is every call
 * on a browser that never fired one.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred
  if (!event) return 'unavailable'
  // Cleared before awaiting, not after: the browser refuses a second prompt
  // on the same event, so holding it past this point would leave a button
  // that looks live and does nothing.
  deferred = null
  notify()
  try {
    await event.prompt()
    const choice = await event.userChoice
    return choice.outcome
  } catch {
    return 'dismissed'
  }
}

/** Subscribes to "the install offer appeared or went away". */
export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test seam: forgets the held event, both window listeners, and every subscriber. */
export function resetInstallForTests(): void {
  deferred = null
  watching?.abort()
  watching = null
  listeners.clear()
}
