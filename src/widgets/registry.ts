import type { ComponentType } from 'react'
import { DayView, type DayViewProps } from './day-plan/DayView'

// The if-then board used to be registered here too, as its own stacked
// section under the day plan. It moved to a single surfaced rule inline
// in DayView (see docs/TIMELINE.md section 6) rather than a widget of its
// own, so it no longer needs a place in this list.
//
// This registry has held one widget ever since. `enabledWidgets`, the
// stored list that said which of them to render, was removed in v2.5: a
// setting with no control anywhere that could change it is not a setting -
// see REMOVED_SETTINGS in storage.ts. The list stays as the seam a second
// widget would slot into, and the day view renders every widget in it.
export interface WidgetDef {
  id: string
  title: string
  Component: ComponentType<DayViewProps>
}

export const WIDGETS: WidgetDef[] = [
  { id: 'day-plan', title: 'Day plan', Component: DayView },
]
