import { useEffect, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { PALETTE_COLORS } from '../lib/colors'
import {
  absorb,
  dropCalendarEntry,
  formatFetchedAt,
  refreshCalendar,
  subscriptionBlocker,
  useCalendarCache,
} from '../lib/calendars'
import type { CalendarSubscription } from '../lib/types'

/**
 * Calendars somebody else owns.
 *
 * Two ways in, because there are two situations. A subscription is a live
 * address that refreshes itself, and needs the sync server to fetch it - a
 * browser is not allowed to read a Google or Outlook feed directly. A file
 * import is the way in when there is no server, and is honest about being a
 * snapshot: it is on this device, it does not refresh, and it does not travel.
 */

export function CalendarSettings() {
  const data = useAppData()
  const cache = useCalendarCache()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingImportName = useRef<string | null>(null)

  const calendars = data.settings.calendars ?? []
  const blocker = subscriptionBlocker()

  // Every half hour while the app is open, and only for feeds that have an
  // address. A calendar nobody is looking at is not worth a request, which is
  // why this lives on the tab rather than on a background timer.
  useEffect(() => {
    if (calendars.length === 0) return
    const timer = setInterval(() => {
      for (const calendar of calendars) {
        if (calendar.enabled && calendar.url) void refreshCalendar(calendar)
      }
    }, 30 * 60 * 1000)
    return () => clearInterval(timer)
  }, [calendars])

  async function handleAdd() {
    const created = actions.addCalendar({ name, url, color: nextColour(calendars) })
    if (!created) return
    setName('')
    setUrl('')
    setAdding(false)
    if (created.url) {
      setBusyId(created.id)
      await refreshCalendar(created)
      setBusyId(null)
    }
  }

  async function handleRefresh(calendar: CalendarSubscription) {
    setBusyId(calendar.id)
    await refreshCalendar(calendar)
    setBusyId(null)
  }

  async function handleImport(file: File | undefined) {
    setImportError(null)
    if (!file) return
    const text = await file.text()
    const label = pendingImportName.current || file.name.replace(/\.ics$/i, '') || 'Imported calendar'
    pendingImportName.current = null
    const created = actions.addCalendar({ name: label, color: nextColour(calendars) })
    if (!created) return
    const outcome = absorb(created.id, text)
    if (!outcome.ok) {
      // A file that turned out not to be a calendar leaves nothing behind -
      // an empty entry in the list would just be litter to explain later.
      actions.deleteCalendar(created.id)
      dropCalendarEntry(created.id)
      setImportError(outcome.message ?? 'That file could not be read as a calendar.')
    }
  }

  function handleDelete(id: string) {
    actions.deleteCalendar(id)
    dropCalendarEntry(id)
    setConfirmDelete(null)
  }

  return (
    <div className="settings-group" id="settings-calendars">
      <h3>Calendars</h3>

      <div className="setting-block">
        <div className="setting-label">
          <span className="setting-name">Someone else's calendar, laid over yours</span>
          <span className="setting-desc">
            Work meetings, a shared family calendar. They appear on Today and on the week as a
            separate layer - outlined, never ticked off, never pushed - and the free-time figure
            counts them, because a morning with three meetings in it is not a free morning.
          </span>
        </div>

        {calendars.length > 0 && (
          <ul className="calendar-list">
            {calendars.map(calendar => {
              const entry = cache[calendar.id]
              return (
                <li key={calendar.id} className="calendar-row">
                  <span
                    className="calendar-swatch"
                    aria-hidden="true"
                    style={{ ['--chip' as string]: calendar.color } as React.CSSProperties}
                  />
                  <div className="calendar-row-main">
                    <span className="calendar-row-name">{calendar.name}</span>
                    <span className="calendar-row-note">
                      {entry?.error ? (
                        <span className="calendar-row-error">{entry.error}</span>
                      ) : calendar.url ? (
                        `${entry?.events.length ?? 0} events - refreshed ${formatFetchedAt(entry?.fetchedAt)}`
                      ) : (
                        `${entry?.events.length ?? 0} events - from a file, on this device only`
                      )}
                    </span>
                    {entry?.ignored?.map(line => (
                      <span key={line} className="calendar-row-note">{line}</span>
                    ))}
                  </div>
                  <div className="calendar-row-actions">
                    <label className="switch" title={calendar.enabled ? 'Showing' : 'Hidden'}>
                      <input
                        type="checkbox"
                        checked={calendar.enabled}
                        onChange={e => actions.updateCalendar(calendar.id, { enabled: e.target.checked })}
                      />
                      <span className="visually-hidden">Show {calendar.name}</span>
                    </label>
                    {calendar.url && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busyId === calendar.id}
                        onClick={() => void handleRefresh(calendar)}
                      >
                        {busyId === calendar.id ? 'Refreshing...' : 'Refresh'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={confirmDelete === calendar.id ? 'btn-danger is-armed' : 'btn-danger'}
                      onClick={() =>
                        confirmDelete === calendar.id ? handleDelete(calendar.id) : setConfirmDelete(calendar.id)
                      }
                      onBlur={() => setConfirmDelete(null)}
                    >
                      {confirmDelete === calendar.id ? 'Confirm remove?' : 'Remove'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {adding ? (
          <div className="calendar-form">
            <label className="sync-field">
              <span>Name</span>
              <input
                type="text"
                placeholder="Work"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="sync-field">
              <span>Secret iCal address</span>
              <input
                type="url"
                inputMode="url"
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </label>
            {blocker && <p className="setting-desc calendar-blocker">{blocker}</p>}
            <div className="calendar-form-actions">
              <button className="primary" disabled={!name.trim() || !url.trim() || !!blocker} onClick={() => void handleAdd()}>
                Add calendar
              </button>
              <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="setting-control">
            <button className="btn-secondary" onClick={() => setAdding(true)}>Subscribe to a calendar</button>
            <button
              className="btn-secondary"
              onClick={() => {
                pendingImportName.current = null
                fileRef.current?.click()
              }}
            >
              Import a .ics file
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={e => {
            void handleImport(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {importError && <p className="warning">{importError}</p>}
      </div>
    </div>
  )
}

/** The next unused palette colour, so two calendars are never the same one. */
function nextColour(existing: CalendarSubscription[]): string {
  const used = new Set(existing.map(c => c.color))
  return PALETTE_COLORS.find(c => !used.has(c.value))?.value ?? PALETTE_COLORS[0].value
}
