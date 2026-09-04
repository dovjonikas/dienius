import { exitDemoMode, isDemoMode } from '../lib/demoMode'
import { useIsWide } from '../lib/viewport'

/**
 * The one line that says none of this is real.
 *
 * Always visible while demo mode is on, at the very top of the app, and never
 * dismissible. A sample plan that can be mistaken for a real one is worse than
 * no sample at all - somebody would tick things off it for a week and then
 * find out. The way out is the same control: leaving throws the sample data
 * away, because a half-finished demo week waiting behind a link a month later
 * is clutter nobody asked to keep.
 *
 * One line means one line. On a phone the full sentence wrapped to three rows
 * and the button to a fourth, 110px of warning above a week grid that had
 * 418px left to draw in; the short form says the one thing that matters and
 * leaves the rest to the wide screen that has room for it.
 */
export function DemoBanner() {
  const isWide = useIsWide()
  if (!isDemoMode()) return null

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner-mark" aria-hidden="true" />
      <span className="demo-banner-text">
        <strong>Demo data.</strong>{' '}
        {isWide
          ? 'Nothing here is yours - it lives under its own key and is thrown away when you leave.'
          : 'Nothing here is yours.'}
      </span>
      <button type="button" className="demo-banner-exit" onClick={exitDemoMode}>
        {isWide ? 'Leave demo' : 'Leave'}
      </button>
    </div>
  )
}
