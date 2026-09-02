import { useEffect, useRef, useState } from 'react'
import { actions, getSaveOk, useAppData } from '../lib/store'
import { STORAGE_KEY, exportJson } from '../lib/storage'
import { clearClockTools } from '../lib/clockTools'
import { findPreset } from '../lib/themes'

import { ThemeGallery } from './ThemeGallery'
import { AppearanceControls } from './AppearanceControls'
import { TimeStepInput } from './TimeStepInput'
import { IfThenBoard } from '../widgets/if-then/IfThenBoard'
import { MinuteStepInput } from './MinuteStepInput'

/**
 * One bedtime or wake-time field, wrapping `TimeStepInput` for the sleep
 * window controls below. `TimeStepInput` itself treats a cleared field as
 * "this is a float now" - a legitimate final state for the task-time field
 * it was built for, where `onChange('')` is exactly what the caller wants.
 * A sleep window has no such state: `Settings.sleepWindow` and
 * `nightSleepWindow` always need both a real bedtime and a real wake time,
 * so an empty commit here is refused rather than written. `resetKey`, bumped
 * only on a refusal, remounts `TimeStepInput` with a fresh internal draft so
 * its own display snaps back to the still-current, unchanged value instead
 * of sitting blank - `TimeStepInput`'s own revert-on-blur only fires for
 * text that fails to parse as a time at all, never for a deliberately empty
 * one, so this is the one case it cannot recover from by itself.
 */
function SleepTimeField({
  value,
  ariaLabel,
  onChange,
}: {
  value: string
  ariaLabel: string
  onChange: (next: string) => void
}) {
  const [resetKey, setResetKey] = useState(0)
  return (
    <TimeStepInput
      key={resetKey}
      value={value}
      ariaLabel={ariaLabel}
      onChange={next => {
        if (next === '') {
          setResetKey(k => k + 1)
          return
        }
        onChange(next)
      }}
    />
  )
}

type SectionId = 'general' | 'sleep' | 'nudges' | 'rules' | 'appearance'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'nudges', label: 'Nudges' },
  { id: 'rules', label: 'Rules' },
  { id: 'appearance', label: 'Appearance' },
]

/** How far down the viewport a section heading has to be before the list stops calling it current. */
const SECTION_ACTIVE_OFFSET_PX = 120

export function SettingsView() {
  const data = useAppData()
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

          <div className="settings-group" id="settings-sleep">
            <h3>Sleep</h3>
            {/* A set-once setting, not a per-day question - see
                docs/DECISIONS.md and actions.setSleepWindow's own doc comment.
                Drawn as a greyed band on the timeline grid and measured into
                the capacity line and every gap - see windowFor in capacity.ts -
                rather than the fixed 07:00-23:00 window this replaces. */}
            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Sleep window</span>
                <span className="setting-desc">
                  When you are normally asleep. The timeline greys it out and free time is measured
                  around it, on every day from now on - you will not be asked again.
                </span>
              </div>
              <div className="setting-control">
                <div className="sleep-window-field">
                  <span className="sleep-window-label">Bedtime</span>
                  <SleepTimeField
                    value={data.settings.sleepWindow.start}
                    ariaLabel="Bedtime"
                    onChange={start => actions.setSleepWindow({ ...data.settings.sleepWindow, start })}
                  />
                </div>
                <div className="sleep-window-field">
                  <span className="sleep-window-label">Wake time</span>
                  <SleepTimeField
                    value={data.settings.sleepWindow.end}
                    ariaLabel="Wake time"
                    onChange={end => actions.setSleepWindow({ ...data.settings.sleepWindow, end })}
                  />
                </div>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-label">
                <span className="setting-name">Night-shift sleep window</span>
                <span className="setting-desc">
                  Used instead on a day typed as a night shift. Real sleep hours around a night shift
                  are not a fixed offset from a day shift, so this gets its own setting.
                </span>
              </div>
              <div className="setting-control">
                <div className="sleep-window-field">
                  <span className="sleep-window-label">Bedtime</span>
                  <SleepTimeField
                    value={data.settings.nightSleepWindow.start}
                    ariaLabel="Bedtime on a night-shift day"
                    onChange={start => actions.setNightSleepWindow({ ...data.settings.nightSleepWindow, start })}
                  />
                </div>
                <div className="sleep-window-field">
                  <span className="sleep-window-label">Wake time</span>
                  <SleepTimeField
                    value={data.settings.nightSleepWindow.end}
                    ariaLabel="Wake time on a night-shift day"
                    onChange={end => actions.setNightSleepWindow({ ...data.settings.nightSleepWindow, end })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="settings-group" id="settings-nudges">
            <h3>Nudges</h3>
            {/* Off by default, and deliberately not a plain interval timer -
                see IntervalReminder.tsx. It can only speak while a task the
                owner marked as Focus is actually running, which is the one
                situation where being interrupted is a favour. */}
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

          <div className="settings-group" id="settings-rules">
            <h3>Rules</h3>
            {/* If-then rules, parked here while they wait for a design worth
                giving them. They used to surface as a line on the day view, and
                on a day with no eligible rule that line was an empty prompt
                taking up the one part of the screen that has to answer "what am
                I doing now" in two seconds. The rules themselves are unchanged
                and every one already written is still here - only where they
                live moved. */}
            <div className="setting-block">
              <div className="setting-label">
                <span className="setting-name">If-then plans</span>
                <span className="setting-desc">
                  A specific trigger paired with a specific response, written down before you need it.
                  Not surfaced on the day view for now.
                </span>
              </div>
              <IfThenBoard />
            </div>
          </div>

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
