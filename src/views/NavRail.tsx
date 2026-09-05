import { useEffect, useState } from 'react'
import { readRailPinned, writeRailPinned } from '../lib/railPrefs'
import {
  CalendarIcon,
  LibraryIcon,
  NorthIcon,
  PinIcon,
  ReviewIcon,
  ScratchIcon,
  SettingsIcon,
  TemplatesIcon,
  TodayIcon,
} from './NavIcons'

export type NavView = 'day' | 'calendar' | 'templates' | 'library' | 'review' | 'north' | 'settings'

export interface NavItem {
  view: NavView
  label: string
  /** The key that also does this, shown in the tooltip. */
  key: string
  Icon: () => React.ReactElement
}

/**
 * The six places the app is used through, in the order the keys number them,
 * and Settings after them. Settings keeps a key of its own rather than a
 * seventh number, because the numbers are for the six screens and a seventh
 * would make that a coincidence rather than a rule.
 */
export const NAV_ITEMS: NavItem[] = [
  { view: 'day', label: 'Today', key: '1', Icon: TodayIcon },
  { view: 'calendar', label: 'Calendar', key: '2', Icon: CalendarIcon },
  { view: 'templates', label: 'Templates', key: '3', Icon: TemplatesIcon },
  { view: 'library', label: 'Library', key: '4', Icon: LibraryIcon },
  { view: 'review', label: 'Review', key: '5', Icon: ReviewIcon },
  { view: 'north', label: 'North', key: '6', Icon: NorthIcon },
]

export const SETTINGS_ITEM: NavItem = { view: 'settings', label: 'Settings', key: ',', Icon: SettingsIcon }

export interface NavRailProps {
  view: NavView
  onNavigate: (view: NavView) => void
  onOpenScratch: () => void
  scratchOpen: boolean
  /** Below the wide breakpoint this is a bar along the bottom, not a rail. */
  isWide: boolean
}

/**
 * The way between the six screens.
 *
 * ## Why it stopped being a row of words
 *
 * Seven text tabs across the top is a row that is always saying seven things,
 * on every screen, above whatever the screen is actually for. It was the
 * second-loudest thing in the app after the day itself, it grew every time a
 * view was added, and at 390px it had already started scrolling sideways -
 * which means two of the seven were reachable only by a gesture nothing on
 * screen suggested.
 *
 * A rail down the left costs 56px of width and says nothing until it is
 * asked. The names are still there, one pointer-rest away or held open by the
 * pin, and every item carries its own key in the tooltip - which is where
 * somebody actually learns a shortcut, not in the card behind "?".
 *
 * ## The two states
 *
 * Closed is icons only, 56px. Open is 176px with the labels beside them, and
 * it opens two ways: a pointer resting on the rail, or the pin, which is
 * remembered per device because a 1366 laptop and a 2560 monitor want
 * different answers. Hovering never moves the page - the open rail is drawn
 * over the content rather than pushing it - because a layout that reflows
 * when a cursor drifts to the left edge is a layout that cannot be trusted.
 * Pinning does move it, once, deliberately.
 *
 * ## The active mark
 *
 * A 2px accent rule on the left edge of the item, and the label a shade
 * brighter. Not a filled pill: a pill is a lot of paint for a fact the
 * screen behind it already makes obvious, and it is the same argument the
 * text tabs settled two versions ago when they gave up their pill for an
 * underline.
 *
 * ## On a phone
 *
 * The same items, the same order, along the bottom instead of down the side.
 * The top of a phone is the hardest part of it to reach and the tab row was
 * up there; underneath, it is under the thumb that is already holding the
 * device. Labels go, because seven of them do not fit at 390px and that was
 * exactly what made the old row scroll.
 */
export function NavRail({ view, onNavigate, onOpenScratch, scratchOpen, isWide }: NavRailProps) {
  const [pinned, setPinned] = useState(readRailPinned)
  const [hovering, setHovering] = useState(false)

  // The pinned width is what the content is laid out against, so it belongs
  // on the root rather than inside the rail - .app reads it to decide how
  // much room to leave. Only while the rail is a rail: on a phone it is a bar
  // along the bottom and there is no column to reserve.
  useEffect(() => {
    const root = document.documentElement
    if (isWide && pinned) root.dataset.railPinned = 'true'
    else delete root.dataset.railPinned
    return () => {
      delete root.dataset.railPinned
    }
  }, [isWide, pinned])

  const open = isWide && (pinned || hovering)

  /**
   * Pressing something in the rail puts the labels away again.
   *
   * The flyout is drawn over the page, and the left of the page is where the
   * mini calendar and Up next live. Without this, clicking a view left the
   * labels sitting over both of them until the pointer happened to leave the
   * rail - the screen you just asked for, half covered by the thing you asked
   * it with. Pinning is unaffected: that is a decision about the layout and
   * survives every press.
   */
  function closeAfterPress() {
    setHovering(false)
  }

  return (
    <nav
      className={open ? 'nav-rail is-open' : 'nav-rail'}
      aria-label="Views"
      data-pinned={isWide && pinned ? 'true' : undefined}
      // Mouse only. A finger arriving at the rail is a finger on its way to
      // pressing something in it, and widening under it would move the target
      // out from under the press.
      onPointerEnter={e => e.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={e => e.pointerType === 'mouse' && setHovering(false)}
      // A keyboard reaching the rail gets the labels too - it is the one way
      // in that cannot hover, and a tab stop on an unlabelled square is the
      // worst of both.
      onFocus={() => isWide && setHovering(true)}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false)
      }}
    >
      <ul className="nav-rail-list">
        {NAV_ITEMS.map(item => (
          <li key={item.view}>
            <RailButton
              item={item}
              active={view === item.view}
              onClick={() => {
                onNavigate(item.view)
                closeAfterPress()
              }}
            />
          </li>
        ))}
      </ul>

      <ul className="nav-rail-list nav-rail-foot">
        <li>
          {/* Not a view, so it is not one of the six and never carries the
              active mark - it opens a layer over whatever is showing. It is
              here because a rail is where somebody looks for the app's own
              controls, and on a desktop Scratch had only a pen in the header
              and two keys nobody had been told about. */}
          <RailButton
            item={{ view: 'day', label: 'Scratch', key: 'S', Icon: ScratchIcon }}
            active={false}
            pressed={scratchOpen}
            onClick={() => {
              onOpenScratch()
              closeAfterPress()
            }}
          />
        </li>
        <li>
          <RailButton
            item={SETTINGS_ITEM}
            active={view === 'settings'}
            onClick={() => {
              onNavigate('settings')
              closeAfterPress()
            }}
          />
        </li>
        {isWide && (
          <li>
            <button
              type="button"
              className="nav-rail-pin"
              aria-pressed={pinned}
              aria-label={pinned ? 'Unpin the sidebar' : 'Keep the sidebar open'}
              title={pinned ? 'Unpin the sidebar' : 'Keep the sidebar open'}
              onClick={() => {
                setPinned(p => {
                  writeRailPinned(!p)
                  return !p
                })
              }}
            >
              <PinIcon pinned={pinned} />
              <span className="nav-rail-label">{pinned ? 'Unpin' : 'Keep open'}</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

function RailButton({
  item,
  active,
  pressed,
  onClick,
}: {
  item: NavItem
  active: boolean
  pressed?: boolean
  onClick: () => void
}) {
  const { label, key, Icon } = item
  return (
    <button
      type="button"
      className={active || pressed ? 'nav-rail-item is-active' : 'nav-rail-item'}
      // The visible label is hidden by width when the rail is closed, so the
      // accessible name has to come from somewhere that is never clipped.
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      // Where a shortcut is actually learned: on the control it belongs to,
      // at the moment somebody is already reaching for it. CONVENTIONS 17.
      title={`${label} - ${key === ',' ? 'comma' : key}`}
      onClick={onClick}
    >
      <span className="nav-rail-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="nav-rail-label" aria-hidden="true">
        {label}
      </span>
    </button>
  )
}
