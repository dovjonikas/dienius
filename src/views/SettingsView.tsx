import { useEffect, useRef, useState } from 'react'
import { actions, getSaveOk, useAppData } from '../lib/store'
import { canInstall, isInstalled, onInstallAvailabilityChange, promptInstall } from '../lib/install'
import { clearSnapshots, listSnapshots, readSnapshot, SNAPSHOTS_KEPT, type SnapshotMeta } from '../lib/snapshots'
import { STORAGE_KEY, exportJson } from '../lib/storage'
import { addDays, todayKey } from '../lib/dates'
import { clearClockTools } from '../lib/clockTools'
import { clearCalendarCache } from '../lib/calendars'
import { enterTourSandbox } from '../lib/tourMode'
import { findPreset } from '../lib/themes'

import { ThemeGallery } from './ThemeGallery'
import { AppearanceControls } from './AppearanceControls'
import { MinuteStepInput } from './MinuteStepInput'
import { TimePicker } from './TimePicker'
import { DEFAULT_EVENING_CLOSE } from '../lib/eveningClose'
import { NorthSettings } from './NorthSettings'
import { CategorySettings } from './CategorySettings'
import { SyncSettings } from './SyncSettings'
import { BackupSettings } from './BackupSettings'
import { CalendarSettings } from './CalendarSettings'
import { requestNotificationPermission } from '../widgets/clock/ClockPopover'

type SectionId = 'general' | 'north' | 'sleep' | 'week' | 'categories' | 'nudges' | 'rules' | 'calendars' | 'backup' | 'sync' | 'appearance'

/**
 * Monday first, because a week does. The values are `Date.getDay()`'s own
 * numbering (0 = Sunday), so nothing anywhere has to translate between a
 * label and a date - see `weekdayOf`.
 */
/**
 * "Today", "Yesterday", or the day and date - a snapshot list is read as
 * "how far back does this go", and two words answer that faster than a date
 * does for the two entries anybody actually reaches for.
 */
function formatSnapshotDate(snap: { date: string }): string {
  const today = todayKey()
  if (snap.date === today) return 'Today'
  if (snap.date === addDays(today, -1)) return 'Yesterday'
  return new Date(`${snap.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

const WEEKDAYS: { value: number; label: string; full: string }[] = [
  { value: 1, label: 'Mon', full: 'Monday' },
  { value: 2, label: 'Tue', full: 'Tuesday' },
  { value: 3, label: 'Wed', full: 'Wednesday' },
  { value: 4, label: 'Thu', full: 'Thursday' },
  { value: 5, label: 'Fri', full: 'Friday' },
  { value: 6, label: 'Sat', full: 'Saturday' },
  { value: 0, label: 'Sun', full: 'Sunday' },
]

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  // Second, right after General. It is the only section here that is about
  // what the app is for rather than how it behaves.
  { id: 'north', label: 'North' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'week', label: 'Week' },
  // After Week and before Nudges: it is about what a day is made of, which
  // belongs with the things that shape a day rather than with the things
  // that interrupt one.
  { id: 'categories', label: 'Categories' },
  { id: 'nudges', label: 'Nudges' },
  { id: 'rules', label: 'Rules' },
  { id: 'calendars', label: 'Calendars' },
  // Near the bottom on purpose. Backup and sync are set up once and then
  // never thought about again; they do not belong next to the things
  // changed weekly. Backup before sync: it is the one of the two that
  // matters on a single device.
  { id: 'backup', label: 'Backup' },
  { id: 'sync', label: 'Sync' },
  { id: 'appearance', label: 'Appearance' },
]

/** How far down the viewport a section heading has to be before the list stops calling it current. */
const SECTION_ACTIVE_OFFSET_PX = 120

export function SettingsView({ onShowShortcuts, onOpenNorth }: { onShowShortcuts?: () => void; onOpenNorth?: () => void } = {}) {
  // Two facts the browser owns rather than the store: whether an install
  // offer is currently held (Chromium fires it when it feels like it, and
  // withdraws it after an install), and whether this page is already running
  // as an installed app. Subscribed rather than read once, because the offer
  // can arrive seconds after the page does.
  const [installable, setInstallable] = useState(canInstall)
  const [installed, setInstalled] = useState(isInstalled)

  useEffect(() => onInstallAvailabilityChange(() => {
    setInstallable(canInstall())
    setInstalled(isInstalled())
  }), [])

  // Read once, when Settings opens. A list that refreshes itself would be
  // watching a store that changes once a day.
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    void listSnapshots().then(setSnapshots)
  }, [])

  async function restoreSnapshot(date: string) {
    const data = await readSnapshot(date)
    if (!data) return
    actions.restoreState(data)
    setRestoring(null)
  }

  async function handleInstall() {
    await promptInstall()
    setInstallable(canInstall())
    setInstalled(isInstalled())
  }

  const data = useAppData()
  const eveningClose = data.settings.eveningClose ?? DEFAULT_EVENING_CLOSE
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  // Which section the list on the left is marking as current. All four are
  // always in the page: this is an index into one scrolling document, not a
  // set of tabs that swap content in and out. That matters for more than
  // tidiness - find-on-page reaches every setting, nothing has to be
  // remembered as "behind the other tab", and a person looking for one switch
  // can scroll past the rest and see what else exists on the way.
  const [section, setSection] = useState<SectionId>('general')

  function handleExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dienius-backup.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // WebKit's download handoff is asynchronous, so revoking the object URL
    // in the same tick can produce an empty or failed download on iOS Safari.
    // Deferring the revoke gives the browser time to start reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    try {
      actions.importData(await file.text())
      setImportError('')
    } catch {
      setImportError('That file is not a valid Dienius backup.')
    } finally {
      // Clear the input so picking the same file again still fires a change event.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Same shape as the crash screen's own reset in ErrorBoundary.tsx - a
  // second confirming tap, then the storage key is removed and the page
  // reloads. Reusing that exact pattern rather than a soft in-memory clear
  // is deliberate: AppData is one JSON blob under one key, so removing the
  // key and reloading is what actually leaves nothing behind - templates,
  // every day's tasks, if-then rules, and any theme choices all live
  // inside it, and a reload means the app comes back through the same
  // loadData() path a fresh install goes through, landing on defaultData()
  // rather than some other code path that has to be kept in sync with it.
  function handleResetClick() {
    if (confirmReset) {
      localStorage.removeItem(STORAGE_KEY)
      // The timer and stopwatch live under their own key - see clockTools.ts -
      // so "erase all data" has to clear that too, or a running timer would
      // outlive the erase and reappear on the fresh install.
      clearClockTools()
      // The daily snapshots live in IndexedDB, under their own database -
      // same reasoning. A copy of everything left behind by "remove
      // everything on this device" is not a snapshot, it is a surprise.
      // Not awaited: the reload below is the point, and a delete that has
      // not finished by then finishes without anybody watching.
      void clearSnapshots()
      // And the cached calendar feeds, under their own key for the same
      // reason. Somebody else's meetings surviving "remove everything on this
      // device" would be the most surprising leftover of the three.
      clearCalendarCache()
      window.location.reload()
    } else {
      setConfirmReset(true)
    }
  }

  function goTo(id: SectionId) {
    setSection(id)
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Keeps the marker honest when the page is scrolled by hand rather than
  // through the list. Plain geometry on a scroll event rather than an
  // IntersectionObserver: this project's own jsdom setup does not provide
  // that API - the same reason viewport.ts guards matchMedia - and four
  // comparisons per scroll frame is not a cost worth a polyfill for.
  useEffect(() => {
    function onScroll() {
      let current: SectionId = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(`settings-${s.id}`)
        if (el && el.getBoundingClientRect().top <= SECTION_ACTIVE_OFFSET_PX) current = s.id
      }
      setSection(current)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="settings">
      <h2>Settings</h2>
      {!getSaveOk() && (
        <p className="warning">Saving to this browser failed. Your changes only live in memory - export a backup.</p>
      )}

      <div className="settings-layout">
        {/* The section list. Links into one document, not tabs - see the
            comment on `section` above. Sticky beside the content at a wide
            viewport so it stays with whatever is being read; a plain
            scrolling row above it on a phone, where a fixed column would eat
            a third of the screen to save nobody anything. */}
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              className={section === s.id ? 'settings-nav-item active' : 'settings-nav-item'}
              aria-current={section === s.id ? 'true' : undefined}
              onClick={() => goTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-group" id="settings-general">
            <h3>General</h3>

            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Backup</span>
                <span className="setting-desc">
                  Everything lives in this browser and nowhere else. Export writes one JSON file with
                  every template, day and setting in it; importing one replaces what is here.
                </span>
              </div>
              <div className="setting-control">
                {/* Primary styling here is the same accent ErrorBoundary's own
                    crash screen gives its export button - the way out stays the
                    visually louder control, one tap, with the destructive one
                    below needing two and never taking the accent colour until
                    it is armed. */}
                <button className="primary" onClick={handleExport}>Export backup</button>
                <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import backup</button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={e => handleImport(e.target.files?.[0])}
            />
            {importError && <p className="warning">{importError}</p>}

            {/* Install. Three honest states rather than a button that is
                sometimes a lie: already installed, installable right now, or
                a browser that has no programmatic install at all - which is
                iOS Safari, the one this app's owner actually uses. That case
                gets the sentence rather than a hidden row, because "you
                cannot" and "here is how" are different answers and only one
                of them is useful. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Install on this device</span>
                <span className="setting-desc">
                  {installed
                    ? 'Already installed. It opens like any other app, works with no connection, and keeps its data on this device.'
                    : installable
                      ? 'Adds Dienius to this device so it opens on its own, without a browser around it. Nothing is uploaded - it is the same app, the same data.'
                      : 'On iPhone and iPad: the Share button, then Add to Home Screen. Other browsers offer it from their own menu once they are ready to.'}
                </span>
              </div>
              <div className="setting-control">
                {installed ? (
                  <span className="setting-state">Installed</span>
                ) : (
                  <button type="button" className="btn-secondary" disabled={!installable} onClick={handleInstall}>
                    {installable ? 'Install' : 'Not available here'}
                  </button>
                )}
              </div>
            </div>

            {/* A week of daily snapshots, in IndexedDB - see lib/snapshots.ts.
                Not a replacement for the export above and not presented as
                one: this covers the mistake somebody did not see coming,
                which is the case a manual backup structurally cannot. */}
            <div className="setting-block">
              <div className="setting-label">
                <span className="setting-name">Restore from a snapshot</span>
                <span className="setting-desc">
                  {snapshots.length === 0
                    ? `A copy of everything is kept once a day, on this device, and the last ${SNAPSHOTS_KEPT} are held. The first one is taken today; there is nothing to restore yet.`
                    : `Taken automatically, once a day, on this device. The last ${SNAPSHOTS_KEPT} are kept. Restoring replaces everything here with that day's copy.`}
                </span>
              </div>
              {snapshots.length > 0 && (
                <ul className="snapshot-list">
                  {snapshots.map(snap => (
                    <li key={snap.date}>
                      <span className="snapshot-when">{formatSnapshotDate(snap)}</span>
                      <span className="snapshot-size">
                        {snap.taskCount} {snap.taskCount === 1 ? 'task' : 'tasks'}, {snap.templateCount}{' '}
                        {snap.templateCount === 1 ? 'template' : 'templates'}
                      </span>
                      <button
                        type="button"
                        className={restoring === snap.date ? 'btn-danger is-armed' : 'btn-secondary'}
                        onBlur={() => setRestoring(current => (current === snap.date ? null : current))}
                        onClick={() => {
                          if (restoring === snap.date) void restoreSnapshot(snap.date)
                          else setRestoring(snap.date)
                        }}
                      >
                        {restoring === snap.date ? 'Replace everything?' : 'Restore'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* The one place the keyboard layer is discoverable without
                already knowing about it. A shortcut nobody can find is a
                shortcut nobody has, and "press ?" is not something an app
                gets to assume. */}
            {onShowShortcuts && (
              <div className="setting-row">
                <div className="setting-label">
                  <span className="setting-name">Keyboard shortcuts</span>
                  <span className="setting-desc">
                    Single keys for the things done most often - adding a task, moving a day, switching tabs.
                    Press ? anywhere to see the list.
                  </span>
                </div>
                <div className="setting-control">
                  <button type="button" className="btn-secondary" onClick={onShowShortcuts}>
                    Show shortcuts
                  </button>
                </div>
              </div>
            )}

            {/* A replay runs in a sandbox - an empty app under its own key,
                thrown away afterwards - because a tour that stamps a starter
                template onto a plan somebody already has is not a tour. See
                lib/tourMode.ts. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Replay the tour</span>
                <span className="setting-desc">
                  Two minutes, nine real actions, in a sandbox that is thrown away when you finish. Your plan is not touched.
                </span>
              </div>
              <div className="setting-control">
                <button type="button" className="btn-secondary" onClick={enterTourSandbox}>
                  Replay tour
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Erase all data</span>
                <span className="setting-desc">
                  Removes everything on this device - every template, every day of tasks, if-then rules,
                  and any theme changes you have made. Export a backup first if you want to keep a copy.
                </span>
              </div>
              <div className="setting-control">
                <button
                  className={confirmReset ? 'btn-danger is-armed' : 'btn-danger'}
                  onClick={handleResetClick}
                  onBlur={() => setConfirmReset(false)}
                >
                  {confirmReset ? 'Confirm reset?' : 'Erase all data'}
                </button>
              </div>
            </div>
          </div>

          <NorthSettings />

          <div className="settings-group" id="settings-sleep">
            <h3>Sleep</h3>
            {/* A named list rather than the pair of fixed windows this used
                to be - an ordinary one and a hardcoded second one for a shift
                the app had decided everybody worked. Each schedule is drawn as
                a greyed band on the timeline grid and measured into the
                capacity line and every gap - see windowFor in capacity.ts. */}
            {data.settings.sleepProfiles.map((profile, index) => (
              <div className="setting-row" key={profile.id}>
                <div className="setting-label">
                  {index === 0 ? (
                    <span className="setting-name">{profile.name}</span>
                  ) : (
                    <input
                      className="setting-name-input"
                      aria-label={'Name of schedule ' + (index + 1)}
                      value={profile.name}
                      maxLength={60}
                      onChange={e => actions.renameSleepProfile(profile.id, e.target.value)}
                    />
                  )}
                  <span className="setting-desc">
                    {index === 0
                      ? 'When you are normally asleep. The timeline greys it out and free time is measured around it, on every day from now on.'
                      : 'Used on days and templates set to this schedule. Everything else keeps the default above.'}
                  </span>
                  {/* Sits in the label column, not beside the two time fields:
                      with it in the control the second row's fields no longer
                      lined up with the first row's, and two rows of the same
                      thing that do not line up read as two different things. */}
                  {index > 0 && (
                    <button
                      type="button"
                      className="setting-remove"
                      aria-label={'Remove schedule ' + (index + 1)}
                      onClick={() => actions.deleteSleepProfile(profile.id)}
                    >
                      Remove this schedule
                    </button>
                  )}
                </div>
                <div className="setting-control">
                  <div className="sleep-window-field">
                    <span className="sleep-window-label">Bedtime</span>
                    <TimePicker
                      value={profile.window.start}
                      ariaLabel={index === 0 ? 'Bedtime' : 'Bedtime for ' + profile.name}
                      required
                      onChange={start => actions.setSleepProfileWindow(profile.id, { ...profile.window, start })}
                    />
                  </div>
                  <div className="sleep-window-field">
                    <span className="sleep-window-label">Wake time</span>
                    <TimePicker
                      value={profile.window.end}
                      ariaLabel={index === 0 ? 'Wake time' : 'Wake time for ' + profile.name}
                      required
                      onChange={end => actions.setSleepProfileWindow(profile.id, { ...profile.window, end })}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* One schedule is the normal case, and until there are two the
                app never says the word "profile" anywhere - the day header and
                the template editor only offer a choice once there is one. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Another schedule</span>
                <span className="setting-desc">
                  For hours that are genuinely a different life - a rota that runs overnight, a week
                  abroad. Days and templates can then pick which one they are measured against.
                </span>
              </div>
              <div className="setting-control">
                <button type="button" className="btn-secondary" onClick={() => actions.addSleepProfile('Shift')}>
                  Add another schedule
                </button>
              </div>
            </div>
          </div>

          {/* The weekday map. In Sleep's own group rather than General
              because it is the other thing about a day that is decided once
              and then stops being a question. */}
          <div className="settings-group" id="settings-week">
            <h3>Week</h3>
            <div className="setting-block">
              <div className="setting-label">
                <span className="setting-name">A template per weekday</span>
                <span className="setting-desc">
                  {data.templates.length === 0
                    ? 'Build a template first and this is where you say which days it belongs to. A day whose weekday has no template starts empty, exactly as it does now.'
                    : 'A new day opens already set up from the template its weekday points at. A day you stamp by hand always wins, and deleting what arrived leaves it deleted - this is a starting point, not a rule.'}
                </span>
              </div>
              {data.templates.length > 0 && (
                <div className="weekday-map">
                  {WEEKDAYS.map(day => (
                    <label key={day.value} className="weekday-map-day">
                      <span className="weekday-map-name">{day.label}</span>
                      <select
                        aria-label={`Template for ${day.full}`}
                        value={data.settings.weekdayTemplates[day.value] ?? ''}
                        onChange={e => actions.setWeekdayTemplate(day.value, e.target.value || undefined)}
                      >
                        <option value="">Nothing</option>
                        {data.templates.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <CategorySettings />

          <div className="settings-group" id="settings-nudges">
            <h3>Nudges</h3>
            {/* The end of the day. Filed under Nudges because it is the only
                other thing in this app that appears without being asked for -
                though unlike the two above it, it never interrupts anything:
                it is a card on a page somebody is already looking at. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Close the day</span>
                <span className="setting-desc">
                  A quiet card in the evening, or the moment the last thing on the list is ticked off.
                  One sentence about the day, and a way to end it.
                </span>
              </div>
              <div className="setting-control">
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={eveningClose.enabled}
                  aria-label="Close the day"
                  onClick={() => actions.setEveningClose({ ...eveningClose, enabled: !eveningClose.enabled })}
                >
                  <span className="switch-thumb" aria-hidden="true" />
                </button>
              </div>
            </div>
            {eveningClose.enabled && (
              <>
                <div className="setting-row">
                  <div className="setting-label">
                    <span className="setting-name">Evening starts at</span>
                    <span className="setting-desc">
                      When the card appears on an ordinary evening. Finishing the last task shows it
                      whatever the time.
                    </span>
                  </div>
                  <div className="setting-control">
                    <TimePicker
                      value={eveningClose.at}
                      ariaLabel="Evening starts at"
                      onChange={at => actions.setEveningClose({ ...eveningClose, at: at || '21:30' })}
                    />
                  </div>
                </div>
                <div className="setting-row">
                  <div className="setting-label">
                    <span className="setting-name">Ask for the best moment</span>
                    <span className="setting-desc">
                      One optional line, kept with the day and shown on the calendar. Off if you would
                      rather not be asked.
                    </span>
                  </div>
                  <div className="setting-control">
                    <button
                      type="button"
                      role="switch"
                      className="switch"
                      aria-checked={eveningClose.askBestMoment}
                      aria-label="Ask for the best moment"
                      onClick={() =>
                        actions.setEveningClose({ ...eveningClose, askBestMoment: !eveningClose.askBestMoment })
                      }
                    >
                      <span className="switch-thumb" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
            {/* Off by default, and deliberately not a plain interval timer -
                see IntervalReminder.tsx. It can only speak while a task the
                owner marked as Focus is actually running, which is the one
                situation where being interrupted is a favour. */}
            {/* Before a task, rather than during one. Deliberately honest
                about its limit: there is no server and no push subscription
                here, so nothing can fire while the app is closed, and saying
                so is better than a setting that quietly does not work. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Before a timed task</span>
                <span className="setting-desc">
                  A notification shortly before anything with a time on it. Only while the app is open -
                  in a tab or installed - because there is no server here to send one from.
                </span>
              </div>
              <div className="setting-control">
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={data.settings.taskReminder.enabled}
                  aria-label="Before a timed task"
                  onClick={() => {
                    const next = !data.settings.taskReminder.enabled
                    if (next) requestNotificationPermission()
                    actions.setTaskReminder({ ...data.settings.taskReminder, enabled: next })
                  }}
                >
                  <span className="switch-thumb" aria-hidden="true" />
                </button>
              </div>
            </div>

            {data.settings.taskReminder.enabled && (
              <div className="setting-row">
                <div className="setting-label">
                  <span className="setting-name">How long before</span>
                  <span className="setting-desc">
                    Enough to finish a sentence and stand up, short enough that the nudge is still about
                    the thing it names.
                  </span>
                </div>
                <div className="setting-control">
                  <MinuteStepInput
                    value={String(data.settings.taskReminder.minutesBefore)}
                    ariaLabel="Minutes before a task"
                    onChange={value => {
                      const minutes = Number(value)
                      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) return
                      actions.setTaskReminder({ ...data.settings.taskReminder, minutesBefore: minutes })
                    }}
                  />
                </div>
              </div>
            )}

            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Nudge during focus work</span>
                <span className="setting-desc">
                  A quiet reminder while a Focus task is running, and only then - never during a meal,
                  a commute, or an evening off.
                </span>
              </div>
              <div className="setting-control">
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={data.settings.reminder.enabled}
                  aria-label="Nudge during focus work"
                  onClick={() =>
                    actions.setReminder({ ...data.settings.reminder, enabled: !data.settings.reminder.enabled })
                  }
                >
                  <span className="switch-thumb" aria-hidden="true" />
                </button>
              </div>
            </div>

            {data.settings.reminder.enabled && (
              <>
                <div className="setting-row">
                  <div className="setting-label">
                    <span className="setting-name">How often</span>
                    <span className="setting-desc">
                      Counted from when the task started, so the first one lands inside the work rather
                      than whenever the app happened to be opened.
                    </span>
                  </div>
                  <div className="setting-control">
                    <MinuteStepInput
                      value={String(data.settings.reminder.everyMinutes)}
                      ariaLabel="Minutes between nudges"
                      onChange={next => {
                        const minutes = Number(next)
                        if (!Number.isFinite(minutes) || minutes < 1) return
                        actions.setReminder({ ...data.settings.reminder, everyMinutes: minutes })
                      }}
                    />
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-label">
                    <span className="setting-name">What it says</span>
                    <span className="setting-desc">
                      The useful reminder is a different sentence for everybody.
                    </span>
                  </div>
                  <div className="setting-control">
                    <input
                      className="setting-text-input"
                      aria-label="Nudge text"
                      maxLength={120}
                      value={data.settings.reminder.text}
                      onChange={e => actions.setReminder({ ...data.settings.reminder, text: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* The rules board that used to sit here is gone. It was a flat list
              under a heading nobody opened, and the one rule it surfaced onto
              the day view was chosen by day type and time of day, which put a
              sentence about somebody's evening in front of them at ten in the
              morning. Rules live under the goal they protect now - see
              views/north/NorthView.tsx. Nothing was deleted in the move: every
              rule already written is in North, under its goal or in the group
              waiting to be given one. */}
          <div className="settings-group" id="settings-rules">
            <h3>Rules</h3>
            <div className="setting-block">
              <div className="setting-label">
                <span className="setting-name">What pulls you off a goal</span>
                <span className="setting-desc">
                  A trigger paired with the one thing you already decided to do about it. They live under
                  the goal they protect, in North.
                </span>
              </div>
              {onOpenNorth && (
                <button type="button" className="btn-secondary" onClick={onOpenNorth}>
                  Open North
                </button>
              )}
            </div>
          </div>

          <CalendarSettings />

          <BackupSettings />

          <SyncSettings />

          <div className="settings-group" id="settings-appearance">
            <h3>Appearance</h3>
            {/* Preset picks the room, mode says whether the light is on - see
                docs/THEMES.md section 4. "Adjust this theme" below lets a
                person hand-tune the active room's own tokens - see section 3. */}
            <div className="setting-block">
              <div className="setting-label">
                <span className="setting-name">Theme</span>
                <span className="setting-desc">
                  Three, and every one of them is a theme somebody would actually keep. All text on
                  all surfaces is checked against WCAG AA before either ships.
                </span>
              </div>
              <ThemeGallery />
            </div>

            {/* "Match system" replaces the old Light / Dark / System control,
                which no longer had a job: with three fixed themes, light or
                dark is the theme, not a mode within one. What is left of the
                idea is the only part that was ever really a preference -
                whether to follow the device - and it swaps the whole theme
                rather than a variant. See presetFor in theme.ts, including
                why it only ever overrides toward light. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Match system appearance</span>
                <span className="setting-desc">
                  Use Light while this device is in light mode, and your chosen dark theme while it
                  is in dark mode - switching with it during the day.
                </span>
              </div>
              <div className="setting-control">
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-checked={data.settings.theme.mode === 'system'}
                  aria-label="Match system appearance"
                  onClick={() =>
                    actions.setTheme(
                      data.settings.theme.mode === 'system'
                        ? findPreset(data.settings.theme.presetId).modes[0]
                        : 'system',
                    )
                  }
                >
                  <span className="switch-thumb" aria-hidden="true" />
                </button>
              </div>
            </div>

            <AppearanceControls />
          </div>
        </div>
      </div>
    </section>
  )
}
