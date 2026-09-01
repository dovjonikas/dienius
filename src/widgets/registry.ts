import type { ComponentType } from 'react'
import { DayView, type DayViewProps } from './day-plan/DayView'

// The if-then board used to be registered here too, as its own stacked
// section under the day plan. It moved to a single surfaced rule inline
// in DayView (see docs/TIMELINE.md section 6) rather than a widget of its
// own, so it no longer needs a place in this list - see
// LEGACY_IF_THEN_WIDGET_ID in storage.ts for how an existing install's
// stored enabledWidgets sheds the now-meaningless id it used to carry.
export interface WidgetDef {
  id: string
  title: string
  Component: ComponentType<DayViewProps>
}

export const WIDGETS: WidgetDef[] = [
  { id: 'day-plan', title: 'Day plan', Component: DayView },
]
