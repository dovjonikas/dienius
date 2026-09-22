import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MEAL_TYPE_LABELS } from '../../lib/kitchen'
import { MEAL_TYPES, type MealType } from '../../lib/types'

/** The meals as one line: "Lunch, dinner", or what is said when there are none. */
export function mealsLine(meals: readonly MealType[], none = 'No meal'): string {
  if (meals.length === 0) return none
  const [first, ...rest] = meals.map(meal => MEAL_TYPE_LABELS[meal])
  return [first, ...rest.map(word => word.toLowerCase())].join(', ')
}

/**
 * A set of meals, chosen in place - Kitchen, v2.32.
 *
 * One quiet line says them - "Lunch, dinner", or "No meal" - and a press on
 * it opens the six under it, each switched on and off by a press and written
 * at once; there is nothing to save. A second press on the line, Escape, or
 * a press anywhere else closes it, and Escape gives the focus back to the
 * line. On a recipe's card, on a pasted recipe's row before it is saved, and
 * beside a word in Settings: three places a meal is chosen without opening
 * the thing it belongs to.
 *
 * The line names itself - "Meals for a bean bowl: Lunch, dinner" - so a
 * screen reader hears whose meals they are; the eye has the card around it.
 */
export function MealsPicker({
  meals,
  label,
  none = 'No meal',
  onChange,
}: {
  meals: readonly MealType[]
  /** What the meals are of - "Meals for a bean bowl" - the line's name and the open group's. */
  label: string
  /** What the line says with no meal chosen. */
  none?: string
  onChange: (next: MealType[]) => void
}) {
  const [open, setOpen] = useState(false)
  // Opened near the window's right edge, the six open leftwards from the line's end.
  const [end, setEnd] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const words = mealsLine(meals, none)

  // A press anywhere outside closes it, the way a menu goes.
  useEffect(() => {
    if (!open) return
    function away(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Measured before the first paint, so the layer is drawn once, in its place.
  useLayoutEffect(() => {
    if (!open) {
      setEnd(false)
      return
    }
    const box = panelRef.current?.getBoundingClientRect()
    if (box && box.right > document.documentElement.clientWidth) setEnd(true)
  }, [open])

  function toggle(meal: MealType) {
    onChange(MEAL_TYPES.filter(m => (m === meal ? !meals.includes(m) : meals.includes(m))))
  }

  return (
    <div
      className="meals-picker"
      ref={rootRef}
      onKeyDown={e => {
        if (e.key !== 'Escape' || !open) return
        // One press, one layer: the page's own Escape stays with the page.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        lineRef.current?.focus()
      }}
    >
      <button
        type="button"
        ref={lineRef}
        className={meals.length === 0 ? 'meals-picker-line is-none' : 'meals-picker-line'}
        aria-label={`${label}: ${words}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(was => !was)}
      >
        <span className="meals-picker-words">{words}</span>
        <span className="meals-picker-caret" aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} ref={panelRef} className={end ? 'meals-picker-panel is-end' : 'meals-picker-panel'} role="group" aria-label={label}>
          {MEAL_TYPES.map(meal => (
            <button
              key={meal}
              type="button"
              className="meals-picker-option"
              aria-pressed={meals.includes(meal)}
              onClick={() => toggle(meal)}
            >
              {MEAL_TYPE_LABELS[meal]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
