import { useUnreadablePlan } from '../lib/unreadable'
import { useIsWide } from '../lib/viewport'

/**
 * The line over every page while a plan this browser could not read is kept
 * aside - see lib/unreadable.ts. The app opened without it, and a person who
 * is not told so thinks the month is gone; the line says it is not, and its
 * button opens Settings where the choices are. Drawn as the sync line is:
 * one line, the button inline, until somebody has chosen.
 */
export function UnreadableBanner({ onOpen }: { onOpen: () => void }) {
  const kept = useUnreadablePlan()
  const isWide = useIsWide()
  if (!kept) return null

  const text = isWide
    ? 'The plan saved in this browser could not be read, so Dienius opened without it. It is kept, as it was.'
    : 'The saved plan could not be read.'

  return (
    <div className="demo-banner sync-banner" role="status">
      <span className="demo-banner-mark sync-banner-mark" aria-hidden="true" />
      <span className="demo-banner-text">{text}</span>
      <button type="button" className="demo-banner-exit" onClick={onOpen}>
        What to do
      </button>
    </div>
  )
}
