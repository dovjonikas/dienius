import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../lib/store'
import { formatDayTitle, todayKey } from '../lib/dates'
import { parseDateQuery, searchEverything, type SearchResult } from '../lib/search'

export interface PaletteAction {
  id: string
  label: string
  /** The word under the label - what it does, or where it goes. */
  detail: string
  run: () => void
}

export interface CommandPaletteProps {
  actions: PaletteAction[]
  onOpenDay: (date: string) => void
  onOpenLibrary: () => void
  onClose: () => void
}

/**
 * One box for the two things a keyboard reaches for: a command, and a thing.
 *
 * Separating them - a command palette here, a search box there - is the
 * arrangement that makes both worse, because the moment you have two you have
 * to know which one you want before you start typing. Everything is in this
 * one list, in three labelled groups, ranked by how well it matched.
 *
 * The commands are supplied by the shell rather than assembled here: this
 * component knows how to show and choose, and nothing about what the app can
 * do. Search is a linear scan over the store - see `search.ts` for why there
 * is no index.
 */
export function CommandPalette({ actions, onOpenDay, onOpenLibrary, onClose }: CommandPaletteProps) {
  const data = useAppData()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const today = todayKey()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matchedActions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return actions
    return actions.filter(a => a.label.toLowerCase().includes(needle) || a.detail.toLowerCase().includes(needle))
  }, [actions, query])

  const results = useMemo(() => searchEverything(data, query, today), [data, query, today])
  const dateJump = useMemo(() => parseDateQuery(query, today), [query, today])

  // One flat list of everything choosable, in the order it is drawn, so the
  // arrow keys and Enter never have to know which group they are in.
  const rows = useMemo(() => {
    const out: { key: string; run: () => void }[] = []
    if (dateJump) out.push({ key: `date:${dateJump}`, run: () => { onOpenDay(dateJump); onClose() } })
    for (const action of matchedActions) out.push({ key: action.id, run: () => { action.run(); onClose() } })
    for (const result of results) out.push({ key: result.id, run: () => { open(result); onClose() } })
    return out
  }, [dateJump, matchedActions, results])

  // Reset on every keystroke rather than trying to keep the same row selected:
  // the list is rebuilt from scratch, so "the same row" is not a thing that
  // survives, and a highlight that lands on something you did not look at is
  // how a palette runs the wrong command.
  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function open(result: SearchResult) {
    if (result.target.type === 'day') onOpenDay(result.target.date)
    else onOpenLibrary()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length === 0) return
      setSelected(i => (i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      rows[selected]?.run()
    }
  }

  let index = 0
  const indexOf = () => index++

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Commands and search"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          role="combobox"
          aria-expanded
          aria-controls="palette-results"
          aria-label="Search or run a command"
          placeholder="Search tasks and lists, or type a command"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <ul className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {dateJump && (
            <Row
              index={indexOf()}
              selected={selected}
              group="Go to"
              title={formatDayTitle(dateJump)}
              detail={dateJump === today ? 'Today' : dateJump}
              onChoose={() => {
                onOpenDay(dateJump)
                onClose()
              }}
            />
          )}

          {matchedActions.map((action, i) => (
            <Row
              key={action.id}
              index={indexOf()}
              selected={selected}
              group={i === 0 ? 'Do' : undefined}
              title={action.label}
              detail={action.detail}
              onChoose={() => {
                action.run()
                onClose()
              }}
            />
          ))}

          {results.map((result, i) => (
            <Row
              key={result.id}
              index={indexOf()}
              selected={selected}
              group={i === 0 ? 'Found' : undefined}
              title={result.title}
              detail={result.detail}
              onChoose={() => {
                open(result)
                onClose()
              }}
            />
          ))}

          {rows.length === 0 && (
            <li className="palette-empty">
              {query.trim().length < 2 ? 'Type to search, or pick something above.' : 'Nothing matches that.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

interface RowProps {
  index: number
  selected: number
  group?: string
  title: string
  detail: string
  onChoose: () => void
}

function Row({ index, selected, group, title, detail, onChoose }: RowProps) {
  const isSelected = index === selected
  return (
    <>
      {group && (
        <li className="palette-group" role="presentation">
          {group}
        </li>
      )}
      <li
        role="option"
        aria-selected={isSelected}
        className={isSelected ? 'palette-row is-selected' : 'palette-row'}
        // Chosen on mouse down rather than click, so a pointer never fights
        // the input for focus on the way to running something.
        onPointerDown={e => {
          e.preventDefault()
          onChoose()
        }}
      >
        <span className="palette-row-title">{title}</span>
        <span className="palette-row-detail">{detail}</span>
      </li>
    </>
  )
}
