import { useState } from 'react'
import { actions, useAppData } from '../lib/store'
import { MEAL_WORD_MAX, mealWordsOf } from '../lib/mealWords'
import type { MealWord } from '../lib/types'
import { MealsPicker } from './kitchen/MealsPicker'

/**
 * Kitchen's section of Settings - v2.32: the words a recipe's name can start
 * with, and the meals each says (lib/mealWords.ts). "Lunch: a bean bowl" is a
 * lunch because the list says Lunch is; somebody who names their food their
 * own way writes their own words here - a word for two meals, or a word that
 * says none and only sorts.
 *
 * Each row is a word and its meals, written as it is changed; a row being
 * written with no word yet stands in the list and is not kept until it has
 * one. The list starts as the six meals' own names.
 */
export function MealWordSettings() {
  const data = useAppData()
  // The rows as they stand here, an unwritten word included; what is kept is
  // what `setMealWords` makes of them.
  const [rows, setRows] = useState<MealWord[]>(() => mealWordsOf(data.settings))

  function write(next: MealWord[]) {
    setRows(next)
    actions.setMealWords(next)
  }

  return (
    <div className="settings-group" id="settings-kitchen">
      <h3>Kitchen</h3>
      <div className="setting-row">
        <div className="setting-label">
          <span className="setting-name">Words a recipe's name starts with</span>
          <span className="setting-desc">
            A name like "Lunch: a bean bowl" is for the meals its first word says here. New recipe and Paste many choose them from
            it, and a press changes them.
          </span>
        </div>
      </div>
      <ul className="meal-words" aria-label="Words and their meals">
        {rows.map((row, index) => (
          <li key={index} className="meal-words-row">
            <input
              className="meal-words-word"
              aria-label={`Word ${index + 1}`}
              maxLength={MEAL_WORD_MAX}
              value={row.word}
              onChange={e => write(rows.map((r, i) => (i === index ? { ...r, word: e.target.value } : r)))}
            />
            <MealsPicker
              meals={row.meals}
              label={`Meals for ${row.word.trim() || `word ${index + 1}`}`}
              onChange={meals => write(rows.map((r, i) => (i === index ? { ...r, meals } : r)))}
            />
            {/* Settings' own way of taking a row out: Delete, named for its row. */}
            <button
              type="button"
              className="setting-remove meal-words-out"
              aria-label={`Remove ${row.word.trim() || `word ${index + 1}`}`}
              onClick={() => write(rows.filter((_, i) => i !== index))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-secondary meal-words-add" onClick={() => setRows([...rows, { word: '', meals: [] }])}>
        Add a word
      </button>
    </div>
  )
}
