import { useState } from 'react'
import { linkKind, linkLabel } from '../lib/link'
import { indexedDbHandleStore, onDeviceFile, openOnDevice, type OpenResult } from '../lib/localFile'

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
  if (kind === 'device') return <FileOut link={link} title={title} label={label} className={className} />
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
 * The same door, for a file on this computer.
 *
 * A button rather than an anchor, because there is no href: the file is read
 * through a handle and handed to a tab as a blob, which takes a moment and
 * can fail in three different ways - see `openOnDevice`. Everything else is
 * the anchor's: the same box, the same 44px, the same bubble under it, and
 * the same refusal to let the press reach the card underneath.
 *
 * What it says when it cannot open is the whole point of it being here. A
 * planner that shrugs is the thing that sent the owner looking for a link
 * field in the first place.
 */
function FileOut({ link, title, label, className }: LinkOutProps & { label: string }) {
  const [said, setSaid] = useState<OpenResult | null>(null)
  const file = onDeviceFile(link)
  return (
    <>
      <button
        type="button"
        className={className ? `link-out ${className}` : 'link-out'}
        data-tip={said ? SAID[said] : label}
        data-link-kind="device"
        aria-label={`Open ${title}, the file ${label}, on this computer`}
        onClick={async e => {
          e.stopPropagation()
          if (!file) return
          setSaid(null)
          const how = await openOnDevice(indexedDbHandleStore(), file.id)
          setSaid(how === 'opened' ? null : how)
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <FileIcon />
      </button>
      {said && (
        <span className="visually-hidden" role="status">
          {SAID[said]}
        </span>
      )}
    </>
  )
}

/**
 * One sentence per way it can fail, because they are different problems and
 * only one of them is the owner's to fix.
 */
const SAID: Record<OpenResult, string> = {
  opened: '',
  elsewhere: 'This file was picked on another computer. Pick it again here to open it from this one.',
  denied: 'The browser did not give access to the file.',
  gone: 'The file has moved or been renamed since it was picked. Pick it again.',
}

/** A page with a corner turned: the one icon in this set that is a document rather than a place. */
function FileIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11 3H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z" />
      <path d="M11 3v5h5" />
    </svg>
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
