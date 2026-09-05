/**
 * The rail's icons, drawn rather than installed.
 *
 * No icon font, no sprite sheet, no library: eight small paths in one file,
 * and nothing to keep in step with a version number. The same reasoning as
 * the caret made of borders and the clock face made of a pseudo-element -
 * this app has never shipped an image it could draw.
 *
 * They are one set and have to read as one, so all eight obey the same
 * rules and a ninth has to as well:
 *
 * - **A 20x20 box**, on the whole-pixel grid wherever a line is horizontal or
 *   vertical, because a 1.5px stroke on a half pixel is a 2px grey smudge.
 * - **One stroke weight, 1.5, and no fills.** A filled icon beside seven
 *   outlined ones is the loudest thing in the rail, and the rail is not
 *   allowed a loudest thing.
 * - **Round caps and joins**, which is the only reason they read as drawn by
 *   the same hand rather than assembled from three sources.
 * - **`currentColor` throughout**, so the rail's own hover and active states
 *   are the whole of the colour logic and no icon has a colour of its own.
 * - **No emoji, ever.** An emoji is somebody else's typeface, it changes
 *   between platforms, and half of them are full colour.
 *
 * They are also deliberately plain. A rail is scanned by position far more
 * than it is read by shape - after a week nobody looks at the icon, they
 * reach for the third one down - so an icon that is instantly legible at
 * 20px beats a cleverer one that is only legible at 40.
 */

const BOX = { viewBox: '0 0 20 20', width: 20, height: 20, fill: 'none', 'aria-hidden': true } as const
const STROKE = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/** A day sheet with today marked on it. */
export function TodayIcon() {
  return (
    <svg {...BOX}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" {...STROKE} />
      <path d="M3 8.5h14M7 2.5v3M13 2.5v3" {...STROKE} />
      <circle cx="10" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

/** The same sheet, ruled into a month. */
export function CalendarIcon() {
  return (
    <svg {...BOX}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" {...STROKE} />
      <path d="M3 8.5h14M7 2.5v3M13 2.5v3M8.5 8.5v8.5M12.5 8.5v8.5M3 13h14" {...STROKE} />
    </svg>
  )
}

/** A stack: one day arranged, and copies of it behind. */
export function TemplatesIcon() {
  return (
    <svg {...BOX}>
      <rect x="6" y="2.5" width="11" height="11" rx="2" {...STROKE} />
      <path d="M13.5 16.5h-8a2 2 0 0 1-2-2v-8" {...STROKE} />
    </svg>
  )
}

/** Three spines on a shelf. */
export function LibraryIcon() {
  return (
    <svg {...BOX}>
      <path d="M4 3.5v13M8 3.5v13M12 3.5v13" {...STROKE} />
      <path d="M15 4.2l2.2 12.1" {...STROKE} />
      <path d="M2.5 16.5h15" {...STROKE} />
    </svg>
  )
}

/** A week, at three heights. Review is the one screen that does count. */
export function ReviewIcon() {
  return (
    <svg {...BOX}>
      <path d="M4.5 16.5v-4M9.5 16.5v-8M14.5 16.5v-11" {...STROKE} />
      <path d="M2.5 16.5h15" {...STROKE} />
    </svg>
  )
}

/** A compass needle. Not an arrow: North is a direction, not an instruction. */
export function NorthIcon() {
  return (
    <svg {...BOX}>
      <circle cx="10" cy="10" r="7.25" {...STROKE} />
      <path d="M10 4.75l2.2 5.25L10 15.25 7.8 10z" {...STROKE} />
    </svg>
  )
}

/** The pen from the header, at rail size. Scratch has always been this shape. */
export function ScratchIcon() {
  return (
    <svg {...BOX}>
      <path d="M13.5 3.2l3.3 3.3-9.5 9.5-4.3 1 1-4.3z" {...STROKE} />
      <path d="M11.6 5.1l3.3 3.3" {...STROKE} />
    </svg>
  )
}

/** Two sliders. A gear at 20px with a 1.5 stroke is a grey circle. */
export function SettingsIcon() {
  return (
    <svg {...BOX}>
      <path d="M3 7h14M3 13h14" {...STROKE} />
      <circle cx="7.5" cy="7" r="2" {...STROKE} />
      <circle cx="12.5" cy="13" r="2" {...STROKE} />
    </svg>
  )
}

/** The rail's own control: a pin, filled once it is holding the rail open. */
export function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg {...BOX}>
      <path
        d="M12.2 2.8l5 5-2.1.6-1.1 4.2-4.8-4.8L13.4 4z"
        {...STROKE}
        fill={pinned ? 'currentColor' : 'none'}
      />
      <path d="M9.2 10.8L4.5 15.5" {...STROKE} />
    </svg>
  )
}
