import type { ComponentType } from 'react'
import { DayView, type DayViewProps } from './day-plan/DayView'
import { IfThenBoard } from './if-then/IfThenBoard'

// Every widget on the day view shares DayView's props - date and
// onDateChange - even though the if-then board below has no use for either.
// Both widgets can absorb them without complaint, so the shape has not
// needed widening yet even with a second widget in the list.
export interface WidgetDef {
  id: string
  title: string
  Component: ComponentType<DayViewProps>
}

export const WIDGETS: WidgetDef[] = [
  { id: 'day-plan', title: 'Day plan', Component: DayView },
  { id: 'if-then', title: 'If-then', Component: IfThenBoard },
]
