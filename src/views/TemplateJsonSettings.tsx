import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { readTemplatesJson, templatesJson, type TemplatesImport } from '../lib/templateJson'
import { todayKey } from '../lib/dates'
import { offerUndo } from '../lib/undo'
import { downloadText } from '../lib/download'

/** What Apply does to a template, in a word. */
const TEMPLATE_WORDS = { create: 'New', update: 'Updated', unchanged: 'Unchanged', skip: 'Skipped' } as const

/** One sentence of what the preview found. */
export function importSummary(read: TemplatesImport): string {
  const count = <T extends { action: string }>(rows: readonly T[], action: T['action']) => rows.filter(r => r.action === action).length
  const said: string[] = []
  const templateParts = (
    [
      [count(read.templates, 'create'), 'new'],
      [count(read.templates, 'update'), 'updated'],
      [count(read.templates, 'unchanged'), 'unchanged'],
      [count(read.templates, 'skip'), 'skipped'],
    ] as const
  ).filter(([n]) => n > 0)
  if (templateParts.length > 0) {
    said.push(templateParts.map(([n, word], i) => (i === 0 ? `${n} ${word} template${n === 1 ? '' : 's'}` : `${n} ${word}`)).join(', '))
  }
  const routineParts = (
    [
      [count(read.routines, 'create'), 'new'],
      [count(read.routines, 'update'), 'updated'],
      [count(read.routines, 'unchanged'), 'unchanged'],
      [count(read.routines, 'skip'), 'skipped'],
    ] as const
  ).filter(([n]) => n > 0)
  if (routineParts.length > 0) {
    said.push(routineParts.map(([n, word], i) => (i === 0 ? `${n} ${word} routine${n === 1 ? '' : 's'}` : `${n} ${word}`)).join(', '))
  }
  const dateParts = (
    [
      [count(read.roster, 'set'), 'set'],
      [count(read.roster, 'clear'), 'taken off'],
      [count(read.roster, 'unchanged'), 'unchanged'],
      [count(read.roster, 'skip'), 'skipped'],
    ] as const
  ).filter(([n]) => n > 0)
  if (dateParts.length > 0) {
    said.push(dateParts.map(([n, word], i) => (i === 0 ? `${n} date${n === 1 ? '' : 's'} ${word}` : `${n} ${word}`)).join(', '))
  }
  if (read.following.length > 0) said.push(`${read.following.length} date${read.following.length === 1 ? '' : 's'} around them composed again`)
  return said.length > 0 ? `${said.join('. ')}.` : 'Nothing in the file to import.'
}

/**
 * Templates as JSON, in Settings - v2.33, lib/templateJson.ts and
 * docs/TEMPLATE-JSON.md. For templates and a roster written somewhere else -
 * by the person, or by another agent - and brought in as one text.
 *
 * Import: the text pasted, Preview says what Apply will do - every template
 * and every routine new, updated, unchanged or skipped and why, every date,
 * every note - and
 * Apply does exactly that, in one step that one undo takes back. A preview is
 * of the text as it was: typing in the field puts it away until Preview is
 * pressed again, so what Apply does is always what was read. Export: the
 * plan's templates and roster from today on in the same format, to copy or
 * to save, the same text every time.
 */
export function TemplateJsonSettings() {
  const data = useAppData()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<TemplatesImport | null>(null)
  const [done, setDone] = useState('')
  const [exported, setExported] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const canApply = !!preview && !preview.error && preview.data !== data

  function apply() {
    if (!canApply) return
    const { read, undo } = actions.importTemplatesJson(text)
    offerUndo('Templates imported', undo)
    setDone(`Applied. ${importSummary(read)}`)
    setPreview(null)
  }

  function download() {
    if (exported === null) return
    downloadText('dienius-templates.json', exported)
  }

  return (
    <div className="settings-group" id="settings-json">
      <h3>Templates as JSON</h3>

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Import templates and roster (JSON)</span>
          <span className="setting-desc">
            A text in the format of docs/TEMPLATE-JSON.md: day templates, and which kind of day stands on which date. Preview
            says what it will do before anything changes; a template of the same name is updated, never copied.
          </span>
        </div>
      </div>
      <textarea
        className="template-json-text"
        aria-label="Templates and roster as JSON"
        rows={8}
        spellCheck={false}
        value={text}
        onChange={e => {
          setText(e.target.value)
          setPreview(null)
          setDone('')
        }}
      />
      <div className="template-json-actions">
        <p className="template-json-said" aria-live="polite">
          {preview && !preview.error ? importSummary(preview) : done}
        </p>
        <button type="button" className="btn-secondary" disabled={!text.trim()} onClick={() => setPreview(readTemplatesJson(text, data, todayKey()))}>
          Preview
        </button>
        <button type="button" className="btn-primary" disabled={!canApply} onClick={apply}>
          Apply
        </button>
      </div>

      {preview?.error && (
        <p className="warning" role="alert">
          {preview.error}
        </p>
      )}
      {preview && !preview.error && (
        <div className="template-json-preview">
          {preview.notes.length > 0 && (
            <ul className="template-json-notes" aria-label="About the file">
              {preview.notes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {preview.templates.length > 0 && (
            <ul className="template-json-rows" aria-label="Templates in the file">
              {preview.templates.map((row, i) => (
                <li key={`${i}:${row.name}`} className={row.action === 'skip' ? 'template-json-row is-skipped' : 'template-json-row'}>
                  <span className="template-json-name">{row.name}</span>
                  <span className="template-json-action">{TEMPLATE_WORDS[row.action]}</span>
                  {row.notes.map(note => (
                    <span key={note} className="template-json-note">
                      {note}
                    </span>
                  ))}
                  {row.reads?.map(line => (
                    <span key={line} className="template-json-note">
                      {line}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {preview.routines.length > 0 && (
            <ul className="template-json-rows" aria-label="Routines in the file">
              {preview.routines.map((row, i) => (
                <li key={`${i}:${row.title}`} className={row.action === 'skip' ? 'template-json-row is-skipped' : 'template-json-row'}>
                  <span className="template-json-name">{row.title}</span>
                  <span className="template-json-action">{TEMPLATE_WORDS[row.action]}</span>
                  {row.notes.map(note => (
                    <span key={note} className="template-json-note">
                      {note}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {preview.roster.length > 0 && (
            <ul className="template-json-rows" aria-label="Dates in the file">
              {preview.roster.map(row => (
                <li key={row.date} className={row.action === 'skip' ? 'template-json-row is-skipped' : 'template-json-row'}>
                  <span className="template-json-name">{row.date}</span>
                  <span className="template-json-action">
                    {row.action === 'set'
                      ? `${row.letter}, ${row.kindName}`
                      : row.action === 'clear'
                        ? 'Taken off'
                        : row.action === 'unchanged'
                          ? 'Unchanged'
                          : 'Skipped'}
                  </span>
                  {row.note && <span className="template-json-note">{row.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Export templates and roster (JSON)</span>
          <span className="setting-desc">
            The day templates, and the roster from today on, in the same format - to change somewhere else and bring back.
          </span>
        </div>
        <div className="setting-control">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setExported(templatesJson(data, todayKey()))
              setCopied(false)
            }}
          >
            Export
          </button>
        </div>
      </div>
      {exported !== null && (
        <>
          <textarea className="template-json-text" aria-label="The templates and roster, as JSON" rows={8} readOnly spellCheck={false} value={exported} />
          <div className="template-json-actions">
            <p className="template-json-said" aria-live="polite">
              {copied ? 'Copied.' : ''}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(exported).then(() => setCopied(true), () => setCopied(false))
              }}
            >
              Copy
            </button>
            <button type="button" className="btn-secondary" onClick={download}>
              Download
            </button>
          </div>
        </>
      )}
    </div>
  )
}
