import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { readPastedLibrary, type PastedRow } from '../lib/libraryPaste'
import { offerUndo } from '../lib/undo'

/** What a row says it will do. */
const STATE_WORDS: Record<PastedRow['state'], string> = {
  new: 'New',
  update: 'Updates the one in the list',
}

/** A row's name while the text above it is edited: its list and its title. */
const rowKey = (row: PastedRow, n: number) => `${n}:${row.list}:${row.title}`

/**
 * A whole shelf pasted at once - the owner's brief of 2026-09-22, part 4.
 *
 * The wall this is for is the Library's own, one shelf up: a list pasted at
 * once has been there since v2.19, and it is a list at a time, with the
 * books' authors typed after. Here the whole library goes in as one text -
 * "A title - An author" a line, a line in capitals naming the list the lines
 * under it go into - read on every keystroke into the rows below (see
 * lib/libraryPaste.ts): every list, every book, and whether saving it makes
 * one or writes over the one there. A row can be left out with its box. One
 * Save writes every row that is ticked, and offers it back as one undo.
 */
export function LibraryPasteMany({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const data = useAppData()
  const [text, setText] = useState('')
  const [into, setInto] = useState(data.library[0]?.name ?? 'Books')
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set())
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  const read = useMemo(() => readPastedLibrary(text, data.library, into), [text, data.library, into])
  const chosen = read.rows.filter((row, n) => !left.has(rowKey(row, n)))
  const adding = chosen.filter(row => row.state === 'new').length
  const updating = chosen.length - adding

  function save() {
    if (chosen.length === 0) return
    const done = actions.importLibrary(chosen)
    const said = [
      done.lists > 0 ? `${done.lists} ${done.lists === 1 ? 'list' : 'lists'} made` : '',
      done.added > 0 ? `${done.added} added` : '',
      done.updated > 0 ? `${done.updated} updated` : '',
    ]
      .filter(Boolean)
      .join(', ')
    offerUndo(`Library saved: ${said}`, done.undo)
    onDone()
  }

  return (
    <>
      <div className="library-header">
        <h2>Paste many books</h2>
      </div>

      <form
        className="library-list kitchen-form kitchen-paste"
        noValidate
        onSubmit={e => {
          e.preventDefault()
          save()
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
            return
          }
          if (e.key === 'Escape' && !e.defaultPrevented) {
            e.preventDefault()
            e.stopPropagation()
            onCancel()
          }
        }}
      >
        <label className="field">
          <span className="field-label">Books</span>
          <textarea
            ref={fieldRef}
            className="kitchen-text"
            rows={12}
            aria-describedby="library-paste-rule"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </label>
        <p id="library-paste-rule" className="kitchen-rule">
          One a line, &quot;A title - An author&quot;. A line in capitals - MAIN, SIDE - is a list, and the lines under it go into it;
          a list this library does not have yet is made.
        </p>

        {/* Where the lines before the first capitals line go. A list that
            exists, or the name typed in the field beside it. */}
        <label className="field library-paste-into">
          <span className="field-label">The lines before the first list go into</span>
          <input value={into} list="library-paste-lists" aria-label="The list the first lines go into" onChange={e => setInto(e.target.value)} />
          <datalist id="library-paste-lists">
            {data.library.map(list => (
              <option key={list.id} value={list.name} />
            ))}
          </datalist>
        </label>

        {read.rows.length > 0 && (
          <ul className="kitchen-paste-rows library-paste-rows" aria-label="What Save will do">
            {read.rows.map((row, n) => {
              const key = rowKey(row, n)
              const heads = n === 0 || read.rows[n - 1].list !== row.list
              return (
                <li key={key} className="kitchen-paste-row library-paste-row" data-list={heads ? row.list : undefined}>
                  <input
                    type="checkbox"
                    className="kitchen-paste-check"
                    aria-label={`Save ${row.title}`}
                    checked={!left.has(key)}
                    onChange={e =>
                      setLeft(was => {
                        const next = new Set(was)
                        if (e.target.checked) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }
                  />
                  <span className="kitchen-paste-name">{row.title}</span>
                  <span className="kitchen-paste-state">{STATE_WORDS[row.state]}</span>
                  {/* The author where the line gave one; the cell stays, empty, so the list keeps its column. */}
                  <span className="kitchen-paste-numbers">{row.author ?? ''}</span>
                  <span className="library-paste-list">{row.list}</span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="kitchen-form-actions">
          <p className="kitchen-paste-count" aria-live="polite">
            {chosen.length === 0
              ? 'Nothing to save yet'
              : [adding > 0 ? `${adding} new` : '', updating > 0 ? `${updating} updated` : ''].filter(Boolean).join(', ')}
          </p>
          <button type="button" className="btn-quiet" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={chosen.length === 0}>
            Save
          </button>
        </div>
      </form>
    </>
  )
}
