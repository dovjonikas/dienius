import { useEffect, useState } from 'react'
import { todayKey } from './lib/dates'
import { useAppData } from './lib/store'
import { applyResolvedTheme, resolveTheme, systemPrefersDark } from './lib/theme'
import { syncThemeColorMeta } from './lib/theme-color'
import { syncManifestTheme } from './lib/manifest-sync'
import { UpdateNotice } from './UpdateNotice'
import { ClockPopover } from './widgets/clock/ClockPopover'
import { FloatingClock } from './widgets/clock/FloatingClock'
import { IntervalReminder } from './widgets/clock/IntervalReminder'
import { FocusBar } from './widgets/clock/FocusBar'
import { FocusView } from './widgets/day-plan/FocusView'
import { activeTask as findActiveTask } from './widgets/day-plan/capacity'
import { actions as storeActions } from './lib/store'
import { clockTools, useClockTools } from './lib/clockTools'
import { CalendarView } from './views/CalendarView'
import { ShortcutsOverlay } from './views/ShortcutsOverlay'
import { shortcutKeyFor } from './lib/shortcuts'
import { addDays } from './lib/dates'
import { LibraryView } from './views/LibraryView'
import { SettingsView } from './views/SettingsView'
import { TemplatesView } from './views/TemplatesView'
import { WIDGETS } from './widgets/registry'

type View = 'day' | 'calendar' | 'templates' | 'library' | 'settings'

const TABS: { view: View; label: string }[] = [
  { view: 'day', label: 'Today' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'templates', label: 'Templates' },
  { view: 'library', label: 'Library' },
  { view: 'settings', label: 'Settings' },
]

export function App() {
  const data = useAppData()
  const [view, setView] = useState<View>('day')
  const [clockOpen, setClockOpen] = useState(false)
  const [focusExpanded, setFocusExpanded] = useState(false)
  const tools = useClockTools()
  const focusTask = tools.focus
    ? data.days[tools.focus.date]?.tasks.find(t => t.id === tools.focus!.taskId)
    : undefined
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Bumped by the N shortcut; the effect below acts on it once the day view
  // has actually rendered. A counter rather than a boolean, so pressing N
  // twice in a row focuses twice rather than doing nothing the second time.
  const [focusQuickAdd, setFocusQuickAdd] = useState(0)

  useEffect(() => {
    if (focusQuickAdd === 0 || view !== 'day') return
    document.querySelector<HTMLInputElement>('[data-quick-add]')?.focus()
  }, [focusQuickAdd, view])

  useEffect(() => {
    function applyTheme() {
      const resolved = resolveTheme(data.settings.theme, systemPrefersDark())
      applyResolvedTheme(document.documentElement, resolved)
      syncThemeColorMeta(resolved.tokens.bg)
      syncManifestTheme(resolved.tokens.bg)
    }
    applyTheme()
    // Only mode 'system' needs to keep watching - a fixed light or dark
    // choice has nothing further to follow. matchMedia can throw or be
    // absent in the same odd environments systemPrefersDark already
    // guards against, so this listener is opt-in rather than assumed safe.
    if (data.settings.theme.mode !== 'system') return
    try {
      const query = window.matchMedia('(prefers-color-scheme: dark)')
      query.addEventListener('change', applyTheme)
      return () => query.removeEventListener('change', applyTheme)
    } catch {
      return undefined
    }
  }, [data.settings.theme])

  // Density and text scale are two attributes on the root, not two sets of
  // token values written per element - styles.css carries one small block for
  // each, overriding the spacing and type scales at their source. That is the
  // whole reason those scales exist as tokens: changing how spacious or how
  // large the entire app is costs six declarations, and nothing anywhere else
  // has to know either setting exists.
  useEffect(() => {
    document.documentElement.dataset.density = data.settings.density
    document.documentElement.dataset.textScale = data.settings.textScale
  }, [data.settings.density, data.settings.textScale])

  function openDay(date: string) {
    setSelectedDate(date)
    setView('day')
  }

  /**
   * The keyboard layer - see lib/shortcuts.ts for the two rules that make a
   * bare-letter shortcut safe in an app whose main gesture is typing.
   *
   * Bound at the document rather than on a focused element, because these
   * are app-level commands and there is no single element that always has
   * focus. Every branch is a plain state change already reachable by a click,
   * so nothing here is the only path to anything.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = shortcutKeyFor(e)
      if (key === null) return

      if (key === 'escape') {
        // Escape closes the loudest thing open, one layer at a time, and
        // never more than one per press - the overlay, then Focus, then the
        // clock. Anything with its own dialog (the detail sheet, the actions
        // menu) stops the event before it reaches here, so those close
        // themselves first and this never fires underneath them.
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (focusExpanded) setFocusExpanded(false)
        else if (clockOpen) setClockOpen(false)
        else return
        e.preventDefault()
        return
      }

      // While the card is open it is the only thing listening, so a stray
      // "3" behind it cannot navigate the page out from under it.
      if (shortcutsOpen) return

      switch (key) {
        case '?':
          setShortcutsOpen(true)
          break
        case 'n':
          // The one shortcut that reaches into a view. A ref chain from here
          // down to the quick-add input would tie the shell to the day view's
          // internals; the box marks itself instead, and the effect below
          // finds it - after the render that mounts it, which a callback
          // fired here would run before when the day view is not on screen
          // yet.
          setView('day')
          setFocusQuickAdd(n => n + 1)
          break
        case 't':
          openDay(todayKey())
          break
        case 'arrowleft':
          if (view === 'day') setSelectedDate(d => addDays(d, -1))
          else return
          break
        case 'arrowright':
          if (view === 'day') setSelectedDate(d => addDays(d, 1))
          else return
          break
        case '1':
          setView('day')
          break
        case '2':
          setView('calendar')
          break
        case '3':
          setView('templates')
          break
        case '4':
          setView('library')
          break
        case '5':
          setView('settings')
          break
        case 'f': {
          const running = activeTaskToday()
          if (!running) return
          clockTools.startFocus(selectedDate, running.id)
          break
        }
        default:
          return
      }
      e.preventDefault()
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  /** The task the clock says is happening right now, or nothing. */
  function activeTaskToday() {
    const day = data.days[selectedDate]
    if (!day) return undefined
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    return findActiveTask(day.tasks, minutes)
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Dienius</span>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.view}
              className={view === tab.view ? 'active' : ''}
              // The label again, as an attribute. The stylesheet renders it a
              // second time at bold weight and zero height, so every tab is
              // already as wide as its own active state and the row cannot
              // shift when one of them becomes bold.
              data-label={tab.label}
              aria-current={view === tab.view ? 'page' : undefined}
              onClick={() => (tab.view === 'day' ? openDay(todayKey()) : setView(tab.view))}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {/* The way in to the timer and the stopwatch. In the header rather
            than on the day view, because both are used while doing something
            other than planning - which is also why the running widget lives at
            the app root and not inside a tab. */}
        <div className="clock-launcher">
          <button
            type="button"
            className={clockOpen ? 'clock-button active' : 'clock-button'}
            aria-haspopup="dialog"
            aria-expanded={clockOpen}
            aria-label="Timer and stopwatch"
            onClick={() => setClockOpen(open => !open)}
          >
            <span className="clock-button-face" aria-hidden="true" />
          </button>
          {clockOpen && <ClockPopover onClose={() => setClockOpen(false)} />}
        </div>
      </header>

      {/* Focus lives above the content and below the header, on every tab, for
          as long as the session lasts - see FocusBar. It is deliberately part
          of the shell rather than of the day view: the whole point of making
          it a state instead of a screen is that the rest of the app keeps
          working while it runs. */}
      <FocusBar onExpand={() => setFocusExpanded(true)} />
      <main className={view === 'day' ? 'main-day' : ''}>
        {view === 'day' &&
          WIDGETS.filter(w => data.settings.enabledWidgets.includes(w.id)).map(w => (
            <w.Component key={w.id} date={selectedDate} onDateChange={setSelectedDate} />
          ))}
        {view === 'calendar' && <CalendarView onOpenDay={openDay} onOpenTemplates={() => setView('templates')} />}
        {view === 'templates' && <TemplatesView />}
        {view === 'library' && <LibraryView onOpenDay={openDay} />}
        {view === 'settings' && <SettingsView onShowShortcuts={() => setShortcutsOpen(true)} />}
      </main>
      {/* Both mounted at the root, outside <main>, so neither is torn down by
          moving between tabs - a timer that stops when you open Settings is
          not a timer. */}
      {/* The optional full-screen version. Not the default any more, and it
          closes back to the bar rather than to nothing, so leaving it is
          leaving a view rather than abandoning the session. */}
      {focusExpanded && focusTask && tools.focus && (
        <FocusView
          task={focusTask}
          onDone={() => {
            if (!focusTask.done) storeActions.toggleTask(tools.focus!.date, focusTask.id)
            clockTools.endFocus()
            setFocusExpanded(false)
          }}
          onClose={() => setFocusExpanded(false)}
        />
      )}

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      <FloatingClock />
      <IntervalReminder date={selectedDate} />
      <UpdateNotice />
    </div>
  )
}
