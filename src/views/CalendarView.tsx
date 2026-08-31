import { useEffect, useMemo, useRef, useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { monthGrid, todayKey } from '../lib/dates'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CalendarViewProps {
  onOpenDay: (date: string) => void
}

export function CalendarView({ onOpenDay }: CalendarViewProps) {
  const data = useAppData()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [stampTemplateId, setStampTemplateId] = useState<string | null>(null)
  const [staged, setStaged] = useState<Record<string, string | null>>({})
  const painting = useRef<'apply' | 'erase' | null>(null)

  const cells = useMemo(() => monthGrid(year, month), [year, month])
  const today = todayKey()

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  function effectiveTemplateId(date: string): string | null {
    if (date in staged) return staged[date]
    return data.days[date]?.templateId ?? null
  }

  function stampCell(date: string, mode: 'apply' | 'erase') {
    if (!stampTemplateId) return
    setStaged(prev => ({ ...prev, [date]: mode === 'apply' ? stampTemplateId : null }))
  }

  function handlePointerDown(date: string, e: React.PointerEvent<HTMLButtonElement>) {
    if (!stampTemplateId) return
    // Touch devices capture the pointer to the element the gesture started on,
    // so onPointerEnter never fires on the cells the finger later passes over.
    // Releasing capture here lets the browser deliver pointer events to
    // whatever cell is actually under the finger as it moves.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const mode = effectiveTemplateId(date) === stampTemplateId ? 'erase' : 'apply'
    painting.current = mode
    stampCell(date, mode)
  }

  function handlePointerEnter(date: string) {
    if (painting.current) stampCell(date, painting.current)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!painting.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const date = el?.closest<HTMLElement>('[data-date]')?.dataset.date
    if (date) stampCell(date, painting.current)
  }

  function endPainting() {
    painting.current = null
  }

  // A finger can lift outside the calendar section entirely (over the browser
  // chrome, or past the edge of the viewport during a fast drag), in which case
  // the section's own onPointerUp/onPointerLeave never fire. Listening on the
  // document guarantees painting always stops, so a stray hover afterward
  // cannot keep stamping cells.
  useEffect(() => {
    document.addEventListener('pointerup', endPainting)
    document.addEventListener('pointercancel', endPainting)
    return () => {
      document.removeEventListener('pointerup', endPainting)
      document.removeEventListener('pointercancel', endPainting)
    }
  }, [])

  function selectTemplate(id: string) {
    setStampTemplateId(prev => (prev === id ? null : id))
  }

  function save() {
    actions.stamp(staged)
    setStaged({})
    setStampTemplateId(null)
  }

  function cancel() {
    setStaged({})
    setStampTemplateId(null)
  }

  const hasChanges = Object.keys(staged).length > 0

  return (
    <section
      className="calendar"
      onPointerUp={endPainting}
      onPointerLeave={endPainting}
      onPointerCancel={endPainting}
      onPointerMove={handlePointerMove}
    >
      <div className="calendar-nav">
        <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>&larr;</button>
        <h2>{MONTHS[month]} {year}</h2>
        <button aria-label="Next month" onClick={() => shiftMonth(1)}>&rarr;</button>
      </div>

      {data.templates.length > 0 && (
        <div className="stamp-bar">
          <span className="muted">Stamp:</span>
          {data.templates.map(t => (
            <button
              key={t.id}
              className={stampTemplateId === t.id ? 'chip selected' : 'chip'}
              aria-pressed={stampTemplateId === t.id}
              style={{ background: t.color }}
              onClick={() => selectTemplate(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map(d => (
          <span key={d} className="weekday">{d}</span>
        ))}
        {cells.map(cell => {
          const templateId = effectiveTemplateId(cell.key)
          const template = templateId ? data.templates.find(t => t.id === templateId) : undefined
          const classes = [
            'cell',
            cell.inMonth ? '' : 'outside',
            cell.key === today ? 'today' : '',
            cell.key in staged ? 'staged' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={cell.key}
              role="gridcell"
              data-date={cell.key}
              className={classes}
              style={template ? { background: template.color } : undefined}
              onPointerDown={e => handlePointerDown(cell.key, e)}
              onPointerEnter={() => handlePointerEnter(cell.key)}
              onClick={() => !stampTemplateId && onOpenDay(cell.key)}
            >
              <span className="cell-num">{Number(cell.key.slice(8))}</span>
              {template && <span className="cell-template">{template.name}</span>}
            </button>
          )
        })}
      </div>

      {hasChanges && (
        <div className="stamp-actions">
          <button className="primary" onClick={save}>Save</button>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}

      {stampTemplateId && !hasChanges && (
        <p className="muted stamp-hint">Click or drag across days to stamp. Click a stamped day to clear it.</p>
      )}
    </section>
  )
}
