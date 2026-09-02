import { useEffect, useState } from 'react'
import { todayKey } from './lib/dates'
import { useAppData } from './lib/store'
import { applyResolvedTheme, resolveTheme, systemPrefersDark } from './lib/theme'
import { syncThemeColorMeta } from './lib/theme-color'
import { syncManifestTheme } from './lib/manifest-sync'
import { UpdateNotice } from './UpdateNotice'
import { CalendarView } from './views/CalendarView'
import { SettingsView } from './views/SettingsView'
import { TemplatesView } from './views/TemplatesView'
import { WIDGETS } from './widgets/registry'

type View = 'day' | 'calendar' | 'templates' | 'settings'

const TABS: { view: View; label: string }[] = [
  { view: 'day', label: 'Today' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'templates', label: 'Templates' },
  { view: 'settings', label: 'Settings' },
]

export function App() {
  const data = useAppData()
  const [view, setView] = useState<View>('day')
  const [selectedDate, setSelectedDate] = useState(todayKey())

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

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Dienius</span>
        <nav>
          {TABS.map(tab => (
            <button
              key={tab.view}
              className={view === tab.view ? 'active' : ''}
              aria-current={view === tab.view ? 'page' : undefined}
              onClick={() => (tab.view === 'day' ? openDay(todayKey()) : setView(tab.view))}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className={view === 'day' ? 'main-day' : ''}>
        {view === 'day' &&
          WIDGETS.filter(w => data.settings.enabledWidgets.includes(w.id)).map(w => (
            <w.Component key={w.id} date={selectedDate} onDateChange={setSelectedDate} />
          ))}
        {view === 'calendar' && <CalendarView onOpenDay={openDay} onOpenTemplates={() => setView('templates')} />}
        {view === 'templates' && <TemplatesView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <UpdateNotice />
    </div>
  )
}
