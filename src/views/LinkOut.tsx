import { linkKind, linkLabel } from '../lib/link'

/**
 * The door to the thing a task or a library item is about.
 *
 * One anchor, in four places: the library row, the day's task card, Up next
 * and the focus screen. Deliberately small and deliberately its own target -
 * a link is not what pressing the card means, and a card whose meaning
 * changed depending on where the pointer landed would be worse than no link
 * at all. So it stops the press from reaching whatever is under it, and the
 * stylesheet gives it the 44px this app gives every control.
 *
 * **Always a new tab.** `target="_blank"` with `rel="noopener noreferrer"`:
 * the first because the whole point is that the planner is still there when
 * the lesson is finished, the second two because a page opened this way can
 * otherwise reach back through `window.opener`, and because a referrer is
 * this app telling somebody else's server what the owner is doing at nine on
 * a Tuesday.
 *
 * The two icons follow the rail's own rules (see NavIcons): a 20x20 box, one
 * 1.5 stroke, no fills, round caps, `currentColor` throughout, so they read
 * as drawn by the same hand as everything else.
 *
 * The icon says which of two kinds of place it goes to - see `linkKind` - and
 * the address itself is in the bubble under it, which is the app's one
 * tooltip (see TipLayer, and CONVENTIONS section 24: it sits below the
 * control, never on it, and nothing moves when the pointer arrives).
 */

export interface LinkOutProps {
  link: string
  /** What it is a link to, for the name a screen reader reads out. */
  title: string
  /** An extra class for the place it is sitting in. */
  className?: string
}

export function LinkOut({ link, title, className }: LinkOutProps) {
  const kind = linkKind(link)
  const label = linkLabel(link)
  return (
    <a
      className={className ? `link-out ${className}` : 'link-out'}
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      data-tip={label}
      data-link-kind={kind}
      aria-label={`Open ${title} at ${label} in a new tab`}
      // The card under this has its own meaning - opening the task, ticking
      // it, selecting it - and this is not it.
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      {kind === 'own' ? <OwnIcon /> : <ExternalIcon />}
    </a>
  )
}

/**
 * A machine of your own: a screen on a stand. Not a padlock and not a house -
 * one says secure, which this is not saying, and the other says home, which
 * is not what a work laptop on the same tailnet is.
 */
function OwnIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="14" height="9" rx="2" />
      <path d="M7 16h6M10 13v3" />
    </svg>
  )
}

/** The open internet: the arrow leaving its box, which is what every browser draws. */
function ExternalIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M16 11v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
      <path d="M12 3h5v5M17 3l-7 7" />
    </svg>
  )
}
