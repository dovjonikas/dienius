import { exitDemoMode, isDemoMode } from '../lib/demoMode'

/**
 * The one line that says none of this is real.
 *
 * Always visible while demo mode is on, at the very top of the app, and never
 * dismissible. A sample plan that can be mistaken for a real one is worse than
 * no sample at all - somebody would tick things off it for a week and then
 * find out. The way out is the same control: leaving throws the sample data
 * away, because a half-finished demo week waiting behind a link a month later
 * is clutter nobody asked to keep.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner-mark" aria-hidden="true" />
      <span className="demo-banner-text">
        <strong>Demo data.</strong> Nothing here is yours - it lives under its own key and is thrown away when you leave.
      </span>
      <button type="button" className="btn-secondary demo-banner-exit" onClick={exitDemoMode}>
        Leave demo
      </button>
    </div>
  )
}
