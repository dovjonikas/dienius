import { useEffect, useState } from 'react'
import { todayKey } from './lib/dates'
import { useAppData } from './lib/store'
import { CalendarView } from './views/CalendarView'
import { SettingsView } from './views/SettingsView'
import { TemplatesView } from './views/TemplatesView'
import { DayView } from './widgets/day-plan/DayView'

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
    document.documentElement.dataset.theme = data.settings.theme
  }, [data.settings.theme])

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
              onClick={() => (tab.view === 'day' ? openDay(todayKey()) : setView(tab.view))}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {view === 'day' && <DayView date={selectedDate} onDateChange={setSelectedDate} />}
        {view === 'calendar' && <CalendarView onOpenDay={openDay} />}
        {view === 'templates' && <TemplatesView />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
