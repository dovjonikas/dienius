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

/**
 * The event index.html caught before this file existed on the page.
 *
 * A browser fires `beforeinstallprompt` once and early - early enough to
 * arrive while this bundle is still being fetched, because the manifest link
 * in the head is all it needs to decide the site is installable. This module
 * used to arm its listener and hope. On a profile where the service worker is
 * already warm the event had come and gone, nobody had it, and Settings said
 * "Not available here" for the rest of the session with no way to get the
 * offer back except another load that happened to be slower.
 *
 * So the head holds a nine-line listener that keeps the event, and this takes
 * it. See `#catch-install-offer` in index.html.
 */
function adoptEarlyInstallOffer(): void {
  const held = (window as Window & { __dieniusInstallOffer?: BeforeInstallPromptEvent | null }).__dieniusInstallOffer
  if (!held) return
  deferred = held
}

/** Starts listening. Safe to call more than once; only the first arms it. */
export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return
  if (watching) return
  watching = new AbortController()
  const { signal } = watching
  adoptEarlyInstallOffer()

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
      forgetEarlyInstallOffer()
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
 * Whether this app is installed on this device, asked of the browser rather
 * than inferred from the window it is being looked at in.
 *
 * `isInstalled` above answers a narrower question than its name suggests: it
 * asks whether *this page* is running as the installed app. Open the same app
 * in an ordinary tab while it sits installed in the launcher and the answer
 * is no, so Settings offered to install something that already was - and
 * because an installed app is exactly the case where a browser stops firing
 * `beforeinstallprompt`, the row could not offer it either. The result was
 * "Not available here" on a browser where it was available and done: the
 * owner had installed it the day before and found it sitting in edge://apps.
 *
 * `getInstalledRelatedApps` is the question with the right shape, and it
 * needs the manifest to name itself under `related_applications` - see
 * public/manifest.webmanifest. Chromium only; everywhere else it is absent
 * and the answer is "do not know", which is the same answer this had before.
 */
export async function isInstalledElsewhere(): Promise<boolean> {
  const ask = (navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<{ platform?: string }[]>
  }).getInstalledRelatedApps
  if (typeof ask !== 'function') return false
  try {
    const found = await ask.call(navigator)
    return found.some(app => app.platform === 'webapp')
  } catch {
    // Refused in an insecure context, and in a few embedded ones. Not knowing
    // is not the same as knowing it is not installed, but it is what can be
    // said, and it leaves the row exactly where it was.
    return false
  }
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
  // that looks live and does nothing. The copy the head is holding goes with
  // it, or the next arm would pick the spent event back up.
  deferred = null
  forgetEarlyInstallOffer()
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
function forgetEarlyInstallOffer(): void {
  if (typeof window === 'undefined') return
  ;(window as Window & { __dieniusInstallOffer?: BeforeInstallPromptEvent | null }).__dieniusInstallOffer = null
}

export function resetInstallForTests(): void {
  deferred = null
  forgetEarlyInstallOffer()
  watching?.abort()
  watching = null
  listeners.clear()
}
