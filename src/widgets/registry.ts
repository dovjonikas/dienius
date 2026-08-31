import type { ComponentType } from 'react'
import { DayView, type DayViewProps } from './day-plan/DayView'

// Every widget on the day view today shares the same props as DayView, since
// there is only one of them. If a second widget with a different shape
// arrives, this is the place to widen the type - not before.
export interface WidgetDef {
  id: string
  title: string
  Component: ComponentType<DayViewProps>
}

export const WIDGETS: WidgetDef[] = [{ id: 'day-plan', title: 'Day plan', Component: DayView }]
