import { useRef, useState } from 'react'
import { actions, getSaveOk, useAppData } from '../lib/store'
import { STORAGE_KEY, exportJson } from '../lib/storage'
import { findPreset } from '../lib/themes'
import { ThemeGallery } from './ThemeGallery'
import { ThemeModeControl } from './ThemeModeControl'
import { ThemeOverridePanel } from './ThemeOverridePanel'
import { TimeStepInput } from './TimeStepInput'

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

export function SettingsView() {
  const data = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

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
      window.location.reload()
    } else {
      setConfirmReset(true)
    }
  }

  return (
    <section className="settings">
      <h2>Settings</h2>
      {!getSaveOk() && (
        <p className="warning">Saving to this browser failed. Your changes only live in memory - export a backup.</p>
      )}
      <div className="settings-group">
        <h3>Theme</h3>
        {/* Preset picks the room, mode says whether the light is on - see
            docs/THEMES.md section 4. "Adjust this theme" below lets a
            person hand-tune the active room's own tokens - see section 3. */}
        <ThemeGallery />
        <ThemeModeControl
          mode={data.settings.theme.mode}
          availableModes={findPreset(data.settings.theme.presetId).modes}
          onChange={actions.setTheme}
        />
        <ThemeOverridePanel />
      </div>
      <div className="settings-group">
        <h3>Sleep</h3>
        {/* A set-once setting, not a per-day question - see
            docs/DECISIONS.md and actions.setSleepWindow's own doc comment.
            Drawn as a greyed band on the timeline grid and measured into the
            capacity line and every gap - see windowFor in capacity.ts -
            rather than the fixed 07:00-23:00 window this replaces. Defaults
            to the exact inverse of that old window, so nobody who never
            opens this page sees any change. */}
        <p className="muted">
          When you're normally asleep. The timeline grid greys it out, and free time is measured
          around it, on every day from now on - you won't be asked again.
        </p>
        <div className="sleep-window-fields">
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
        <p className="muted">
          On a day typed as a night shift, this is used instead - your actual sleep hours around a
          night shift are not a fixed offset from a day shift's, so it gets its own setting.
        </p>
        <div className="sleep-window-fields">
          <div className="sleep-window-field">
            <span className="sleep-window-label">Bedtime (night shift)</span>
            <SleepTimeField
              value={data.settings.nightSleepWindow.start}
              ariaLabel="Bedtime on a night-shift day"
              onChange={start => actions.setNightSleepWindow({ ...data.settings.nightSleepWindow, start })}
            />
          </div>
          <div className="sleep-window-field">
            <span className="sleep-window-label">Wake time (night shift)</span>
            <SleepTimeField
              value={data.settings.nightSleepWindow.end}
              ariaLabel="Wake time on a night-shift day"
              onChange={end => actions.setNightSleepWindow({ ...data.settings.nightSleepWindow, end })}
            />
          </div>
        </div>
      </div>
      <div className="settings-group">
        <h3>Data</h3>
        <div className="row">
          {/* Primary styling here is the same accent ErrorBoundary's own crash
              screen gives its export button - the way out stays the visually
              louder control, one tap, with the destructive one below needing
              two and never taking the accent color until it is armed. */}
          <button className="primary" onClick={handleExport}>Export backup</button>
          <button onClick={() => fileRef.current?.click()}>Import backup</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={e => handleImport(e.target.files?.[0])}
        />
        {importError && <p className="warning">{importError}</p>}
        <p className="muted">
          Erase everything on this device - every template, every day's tasks, if-then rules, and any
          theme changes you have made. Export a backup first if you want to keep a copy.
        </p>
        <div className="row">
          <button
            className={confirmReset ? 'danger' : ''}
            onClick={handleResetClick}
            onBlur={() => setConfirmReset(false)}
          >
            {confirmReset ? 'Confirm reset?' : 'Erase all data'}
          </button>
        </div>
      </div>
    </section>
  )
}
