import { useId, useState } from 'react'
import { actions, useAppData } from '../../lib/store'
import { MEAL_TYPE_LABELS, isMealCategory } from '../../lib/kitchen'
import { addDays, shortWeekday } from '../../lib/dates'
import { templateName } from '../../lib/names'
import type { Recipe, Template } from '../../lib/types'
import { TimePicker } from '../TimePicker'
import { DurationControl } from '../DurationControl'

/** Where the recipe goes: one of the template's meal blocks, or a new one. */
type Into = { kind: 'block'; blockId: string } | { kind: 'new' }

/** A Sunday, from which a weekday number is that many days on - for its short name. */
const A_SUNDAY = '2026-09-20'

/** A meal block as the choice names it: its weekday on a week, its time, its name. */
function blockLabel(template: Template, block: Template['blocks'][number]): string {
  const day = template.kind === 'week' && block.weekday !== undefined ? `${shortWeekday(addDays(A_SUNDAY, block.weekday))} ` : ''
  return `${day}${block.time ? `${block.time} ` : ''}${block.title}`
}

/**
 * A recipe put into a template from its own page, the way a book is put into
 * one from the Library - Kitchen, since v2.30, docs/RESEARCH-KITCHEN.md section
 * 6.5. A template, then one of its meal blocks for the recipe to join - it
 * becomes one of the recipes that block walks, a day at a time - or a new meal
 * block at a time and a length, named for the recipe's first meal. A new block
 * is only offered on a day template: on a week one a block belongs to a
 * weekday, and the week's editor is where that is said.
 */
export function AddRecipeToTemplate({ recipe, onAdded, onCancel }: { recipe: Recipe; onAdded: (said: string) => void; onCancel: () => void }) {
  const data = useAppData()
  const [templateId, setTemplateId] = useState(data.templates[0]?.id ?? '')
  const template = data.templates.find(t => t.id === templateId)
  const meals = template ? template.blocks.filter(b => isMealCategory(b.category)) : []
  const [chosen, setChosen] = useState<Into | null>(null)
  const into: Into = chosen ?? (meals[0] ? { kind: 'block', blockId: meals[0].id } : { kind: 'new' })
  const [name, setName] = useState(recipe.mealTypes?.[0] ? MEAL_TYPE_LABELS[recipe.mealTypes[0]] : 'Meal')
  const [time, setTime] = useState('')
  const [minutes, setMinutes] = useState<number | undefined>(30)
  const groupId = useId()

  if (data.templates.length === 0 || !template) {
    return <p className="kitchen-template-note">No templates yet - build one first, in the Templates tab.</p>
  }

  const canNew = template.kind !== 'week'

  function add() {
    if (!template) return
    if (into.kind === 'block') {
      const block = template.blocks.find(b => b.id === into.blockId)
      if (block && actions.addRecipeToTemplate(template.id, recipe.id, { blockId: block.id })) {
        onAdded(`Added to ${block.title} on ${templateName(template)}.`)
      }
      return
    }
    const title = name.trim() || 'Meal'
    if (actions.addRecipeToTemplate(template.id, recipe.id, { block: { title, time: time || undefined, minutes } })) {
      onAdded(`Added to ${title} on ${template.name}.`)
    }
  }

  return (
    <div className="library-list kitchen-template-form">
      <label className="field">
        <span className="field-label">Template</span>
        <select
          value={templateId}
          onChange={e => {
            setTemplateId(e.target.value)
            setChosen(null)
          }}
        >
          {data.templates.map(t => (
            <option key={t.id} value={t.id}>
              {templateName(t)}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label" id={groupId}>
          Into
        </span>
        <div className="kitchen-template-into" role="radiogroup" aria-labelledby={groupId}>
          {meals.map(block => (
            <label key={block.id} className="kitchen-template-choice">
              <input
                type="radio"
                name={`${groupId}-into`}
                checked={into.kind === 'block' && into.blockId === block.id}
                onChange={() => setChosen({ kind: 'block', blockId: block.id })}
              />
              {blockLabel(template, block)}
            </label>
          ))}
          {canNew && (
            <label className="kitchen-template-choice">
              <input type="radio" name={`${groupId}-into`} checked={into.kind === 'new'} onChange={() => setChosen({ kind: 'new' })} />
              A new meal block
            </label>
          )}
        </div>
        {!canNew && meals.length === 0 && (
          <p className="kitchen-template-note">This week has no meal block yet - add one in its editor first.</p>
        )}
      </div>

      {into.kind === 'new' && canNew && (
        <div className="kitchen-template-new">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={name} onChange={e => setName(e.target.value)} />
          </label>
          <div className="field">
            <span className="field-label">At</span>
            <TimePicker value={time} onChange={setTime} ariaLabel="At" placeholder="19:00" />
          </div>
          <div className="field">
            <span className="field-label">For</span>
            <DurationControl minutes={minutes} allowEmpty stepperLabel="For, in minutes" onChange={setMinutes} />
          </div>
        </div>
      )}

      <div className="kitchen-template-actions">
        <button type="button" className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={add} disabled={into.kind === 'new' ? !canNew : meals.length === 0}>
          Add
        </button>
      </div>
    </div>
  )
}
