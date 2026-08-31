import { useRef, useState } from 'react'
import { actions, getSaveOk, useAppData } from '../lib/store'
import { exportJson } from '../lib/storage'

export function SettingsView() {
  const data = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')

  function handleExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dienius-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File | undefined) {
    if (!file) return
    try {
      actions.importData(await file.text())
      setImportError('')
    } catch {
      setImportError('That file is not a valid Dienius backup.')
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
        <div className="segmented">
          <button
            className={data.settings.theme === 'light' ? 'active' : ''}
            onClick={() => actions.setTheme('light')}
          >
            Light
          </button>
          <button
            className={data.settings.theme === 'dark' ? 'active' : ''}
            onClick={() => actions.setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
      <div className="settings-group">
        <h3>Data</h3>
        <div className="row">
          <button onClick={handleExport}>Export backup</button>
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
      </div>
    </section>
  )
}
