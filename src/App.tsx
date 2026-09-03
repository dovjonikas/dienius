import { useEffect, useState } from 'react'
import { todayKey } from './lib/dates'
import { useAppData } from './lib/store'
import { applyResolvedTheme, resolveTheme, systemPrefersDark } from './lib/theme'
import { syncThemeColorMeta } from './lib/theme-color'
import { syncManifestTheme } from './lib/manifest-sync'
import { UpdateNotice } from './UpdateNotice'
import { UndoToast } from './widgets/UndoToast'
import { ClockPopover } from './widgets/clock/ClockPopover'
import { FloatingClock } from './widgets/clock/FloatingClock'
import { IntervalReminder } from './widgets/clock/IntervalReminder'
import { TaskReminder } from './widgets/clock/TaskReminder'
import { FocusBar } from './widgets/clock/FocusBar'
import { FocusView } from './widgets/day-plan/FocusView'
import { activeTask as findActiveTask } from './widgets/day-plan/capacity'
import { actions as storeActions, getData } from './lib/store'
import { snapshotToday } from './lib/snapshots'
import { DemoBanner } from './views/DemoBanner'
import { Tour } from './views/tour/Tour'
import { Scratch } from './views/scratch/Scratch'
import { ScratchFab } from './views/scratch/ScratchFab'
import { useIsWide } from './lib/viewport'
import { requestReplan } from './lib/replanState'
import { clockTools, useClockTools } from './lib/clockTools'
import { CalendarView } from './views/CalendarView'
import { ShortcutsOverlay } from './views/ShortcutsOverlay'
import { CommandPalette, type PaletteAction } from './views/CommandPalette'
import { shortcutKeyFor } from './lib/shortcuts'
import { addDays } from './lib/dates'
import { LibraryView } from './views/LibraryView'
import { ReviewView } from './views/ReviewView'
import { SettingsView } from './views/SettingsView'
import { TemplatesView } from './views/TemplatesView'
import { WIDGETS } from './widgets/registry'

type View = 'day' | 'calendar' | 'templates' | 'library' | 'review' | 'settings'

const TABS: { view: View; label: string }[] = [
  { view: 'day', label: 'Today' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'templates', label: 'Templates' },
  { view: 'library', label: 'Library' },
  { view: 'review', label: 'Review' },
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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [scratchOpen, setScratchOpen] = useState(false)
  const isWide = useIsWide()
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
  // One snapshot a day, on first open - see lib/snapshots.ts. Fired once
  // per mount and never awaited: it is a courtesy against a bad five
  // minutes, and nothing about the app may wait on IndexedDB to answer.
  useEffect(() => {
    void snapshotToday(getData(), todayKey())
  }, [])

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
      // The one chord this app claims, because it is the one every other app
      // with a palette claims too - taking it is less surprising than not
      // taking it. Checked before shortcutKeyFor, which rejects every
      // modifier held: a chord is exactly what that rule exists to leave
      // alone, and this is the single exception to it.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(open => !open)
        return
      }

      const key = shortcutKeyFor(e)
      if (key === null) return

      if (key === 'escape') {
        // Escape closes the loudest thing open, one layer at a time, and
        // never more than one per press - the palette, then the shortcut
        // card, then Focus, then the clock. Anything with its own dialog
        // (the detail sheet, the actions menu) stops the event before it
        // reaches here, so those close themselves first and this never
        // fires underneath them.
        if (scratchOpen) setScratchOpen(false)
        else if (paletteOpen) setPaletteOpen(false)
        else if (shortcutsOpen) setShortcutsOpen(false)
        else if (focusExpanded) setFocusExpanded(false)
        else if (clockOpen) setClockOpen(false)
        else return
        e.preventDefault()
        return
      }

      // While either of them is open it is the only thing listening, so a
      // stray "3" behind it cannot navigate the page out from under it.
      if (shortcutsOpen || paletteOpen || scratchOpen) return

      switch (key) {
        // Two keys for the same thing, because the one that is fastest to
        // hit depends on the keyboard: S sits under the left hand, the
        // backtick is the corner key nothing else in this app wants.
        case 's':
        case '`':
          setScratchOpen(true)
          break
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
          setView('review')
          break
        case '6':
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

  /**
   * What the palette can do, assembled here because this is the only place
   * that knows all of it. Every one of these is already reachable by hand -
   * the palette is a faster route, never the only one.
   */
  const paletteActions: PaletteAction[] = [
    { id: 'go-today', label: 'Today', detail: 'The day view', run: () => openDay(todayKey()) },
    { id: 'go-calendar', label: 'Calendar', detail: 'Stamp templates onto dates', run: () => setView('calendar') },
    { id: 'go-templates', label: 'Templates', detail: 'Build and edit day templates', run: () => setView('templates') },
    { id: 'go-library', label: 'Library', detail: 'Books, series, anything with a unit', run: () => setView('library') },
    { id: 'go-review', label: 'Review', detail: 'How the week went', run: () => setView('review') },
    { id: 'go-settings', label: 'Settings', detail: 'Sleep, week, nudges, appearance', run: () => setView('settings') },
    {
      id: 'new-task',
      label: 'New task',
      detail: 'Jump to the box on today',
      run: () => {
        openDay(todayKey())
        setFocusQuickAdd(n => n + 1)
      },
    },
    // The three replan doors, from anywhere. Each lands on today and opens
    // the sheet there - the day view owns the sheet, this only asks.
    {
      id: 'replan-interrupt',
      label: 'Something came up',
      detail: 'Fit it in; what it hits moves or goes',
      run: () => {
        openDay(todayKey())
        requestReplan('interrupt')
      },
    },
    {
      id: 'replan-shift',
      label: 'Shift the rest',
      detail: 'Everything from now, later',
      run: () => {
        openDay(todayKey())
        requestReplan('shift')
      },
    },
    {
      id: 'replan-away',
      label: 'Away',
      detail: 'Pause the day; one rescue when you are back',
      run: () => {
        openDay(todayKey())
        requestReplan(getData().days[todayKey()]?.away ? 'back' : 'away')
      },
    },
    { id: 'scratch', label: 'Scratch', detail: 'Write something down now, sort it out later', run: () => setScratchOpen(true) },
    { id: 'timer-25', label: 'Start a 25 minute timer', detail: 'Runs on every tab', run: () => clockTools.startTimer(25 * 60_000) },
    { id: 'timer-5', label: 'Start a 5 minute timer', detail: 'Runs on every tab', run: () => clockTools.startTimer(5 * 60_000) },
    { id: 'stopwatch', label: 'Start the stopwatch', detail: 'No deadline, just counting', run: () => clockTools.startStopwatch() },
    { id: 'shortcuts', label: 'Keyboard shortcuts', detail: 'The single-key list', run: () => setShortcutsOpen(true) },
  ]

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
      <DemoBanner />
      <FocusBar onExpand={() => setFocusExpanded(true)} />
      <main className={view === 'day' ? 'main-day' : ''}>
        {view === 'day' &&
          WIDGETS.filter(w => data.settings.enabledWidgets.includes(w.id)).map(w => (
            <w.Component key={w.id} date={selectedDate} onDateChange={setSelectedDate} />
          ))}
        {view === 'calendar' && (
          <CalendarView
            onOpenDay={openDay}
            onOpenTemplates={() => setView('templates')}
            date={selectedDate}
            onDateChange={setSelectedDate}
          />
        )}
        {view === 'templates' && <TemplatesView />}
        {view === 'library' && <LibraryView onOpenDay={openDay} />}
        {view === 'review' && <ReviewView onOpenDay={openDay} />}
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

      {paletteOpen && (
        <CommandPalette
          actions={paletteActions}
          onOpenDay={openDay}
          onOpenLibrary={() => setView('library')}
          onOpenScratch={() => setScratchOpen(true)}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      <FloatingClock />
      <IntervalReminder date={selectedDate} />
      {/* Both at the root, outside <main>, so neither is torn down by moving
          between tabs - a reminder that stops when you open Settings is not
          a reminder. */}
      <TaskReminder date={selectedDate} />
      {/* One undo offer, app-wide - see lib/undo.ts. At the root because
          what it undoes could have happened on any tab. */}
      <UndoToast />
      <UpdateNotice />
      {/* The tour, at the root: it points at things on every tab and has
          to outlive the tab it is pointing at. See views/tour/Tour.tsx. */}
      <Tour onNavigate={target => (target === 'day' ? openDay(todayKey()) : setView(target))} />
      {/* Scratch: the layer under everything, reached by one key on a
          keyboard and by one floating button on a phone. See lib/scratch.ts.
          The button only exists where there is no key to press. */}
      <Scratch open={scratchOpen} onClose={() => setScratchOpen(false)} />
      {!isWide && !scratchOpen && <ScratchFab onOpen={() => setScratchOpen(true)} />}
    </div>
  )
}
