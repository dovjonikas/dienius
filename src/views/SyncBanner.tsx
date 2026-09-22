import { useSyncStatus } from '../lib/syncClient'
import { useIsWide } from '../lib/viewport'

/**
 * The one line sync puts outside Settings: while the first connection waits
 * for an answer, and while sync is failing.
 *
 * Both are states a person has to do something about and would otherwise
 * not know of - Settings is where they are explained, and nobody reads
 * Settings to find out whether their phone is current. An error in sync is
 * never silent (docs/SYNC-AUDIT.md, path 9), and a first connection that
 * nobody answers is a device that never syncs. Being offline is neither: it
 * catches up by itself, and says so in Settings.
 *
 * Drawn as the demo line is - one line, the button inline.
 */
export function SyncBanner({ onOpen }: { onOpen: () => void }) {
  const status = useSyncStatus()
  const isWide = useIsWide()
  const waiting = status.phase === 'choice'
  if (!waiting && status.phase !== 'error') return null

  const text = waiting
    ? isWide
      ? 'Sync is waiting for you to choose which plan this device keeps. Nothing is written until you do.'
      : 'Sync is waiting for your choice.'
    : isWide
      ? `Sync did not go through. ${status.message ?? 'Nothing on this device was changed.'}`
      : 'Sync did not go through.'

  return (
    <div className="demo-banner sync-banner" role="status">
      <span className="demo-banner-mark sync-banner-mark" aria-hidden="true" />
      <span className="demo-banner-text">{text}</span>
      <button type="button" className="demo-banner-exit" onClick={onOpen}>
        {waiting ? 'Choose' : 'Open Sync'}
      </button>
    </div>
  )
}
