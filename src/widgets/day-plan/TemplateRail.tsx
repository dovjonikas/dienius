import { actions, useAppData } from '../../lib/store'

export interface TemplateRailProps {
  /** The day currently open in the day view - restamped on tap. */
  date: string
}

/**
 * Lists data.templates as coloured chips, in place of Sunsama's CHANNELS
 * list - docs/LAYOUT-WIDE.md section 3.1. Tapping one calls the same
 * actions.stamp the calendar's own stamp bar already calls, against the
 * date currently open here - this does not add a decision, stamping
 * already happens today only through the Calendar tab, this removes a
 * detour. Additive-only, matching what actions.stamp already does: there
 * is no un-stamp tap here (tapping the already-selected chip simply
 * re-applies it) - clearing a stamp stays a Calendar-tab action, unchanged.
 * Rendered only when useIsWide() is true, and only once there is at least
 * one template to show - see DayView.tsx.
 */
export function TemplateRail({ date }: TemplateRailProps) {
  const data = useAppData()
  if (data.templates.length === 0) return null
  const currentTemplateId = data.days[date]?.templateId

  return (
    <div className="template-rail">
      <h3>Templates</h3>
      <div className="template-rail-chips">
        {data.templates.map(t => (
          <button
            key={t.id}
            type="button"
            className={t.id === currentTemplateId ? 'template-chip selected' : 'template-chip'}
            aria-pressed={t.id === currentTemplateId}
            style={{ ['--chip' as string]: t.color } as React.CSSProperties}
            onClick={() => actions.stamp({ [date]: t.id })}
          >
            <span className="template-chip-dot" aria-hidden="true" />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
