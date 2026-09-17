import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { actions } from '../../lib/store'
import { readRecipe, type RecipePart } from '../../lib/recipeText'
import { useRestoreFocus } from '../../lib/useRestoreFocus'
import { useWakeLock } from '../../lib/useWakeLock'
import type { Recipe } from '../../lib/types'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Cook: a recipe on a screen meant to be read from arm's length with wet
 * hands - Kitchen, since v2.27.
 *
 * Over everything, the way Focus is, and larger than the recipe's page: the
 * name, the text before the headings, each ingredient and each step as a line
 * with a box that a press ticks off, and any other heading over its
 * paragraphs. A tick is a mark on the place in the recipe and nothing more:
 * it belongs to this cooking, lives in this screen and goes with it -
 * docs/RESEARCH-KITCHEN.md has why a stored tick would be the wrong thing.
 *
 * The screen is kept awake while it is open (useWakeLock), where the browser
 * can. Done adds one to how many times the recipe was cooked and closes;
 * Close or Escape leaves without counting anything. A bare key pressed here
 * is the screen's own - `data-keeps-keys` - so a stray 3 cannot take the
 * recipe away mid-step.
 */
export function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  useRestoreFocus()
  useWakeLock(true)
  const dialogRef = useRef<HTMLDivElement>(null)
  const reading = readRecipe(recipe.text)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusables || focusables.length === 0) return
    const list = Array.from(focusables)
    const first = list[0]
    const last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="kitchen-cook"
      role="dialog"
      aria-modal="true"
      aria-label={`Cook: ${recipe.title}`}
      ref={dialogRef}
      tabIndex={-1}
      data-keeps-keys
      onKeyDown={handleKeyDown}
    >
      <button type="button" className="focus-close" onClick={onClose}>
        Close
        <span className="focus-close-hint" aria-hidden="true">
          Esc
        </span>
      </button>

      <div className="kitchen-cook-page">
        <h2 className="kitchen-cook-title">{recipe.title}</h2>

        {reading.intro.length > 0 && (
          <div className="kitchen-cook-intro">
            {reading.intro.map((paragraph, i) => (
              <p key={i} className="kitchen-cook-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {reading.parts.map((part, i) => (
          <CookPart key={i} part={part} />
        ))}

        <button
          type="button"
          className="btn-primary kitchen-cook-done"
          onClick={() => {
            actions.markCooked(recipe.id)
            onClose()
          }}
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** One part, larger: a list to tick off, or a heading over its paragraphs. */
function CookPart({ part }: { part: RecipePart }) {
  const headingId = useId()
  const heading = (
    <h3 id={headingId} className="kitchen-cook-heading">
      {part.heading.replace(/\s*:$/, '')}
    </h3>
  )
  if (part.kind === 'section') {
    return (
      <section className="kitchen-cook-part">
        {heading}
        {part.paragraphs.map((paragraph, i) => (
          <p key={i} className="kitchen-cook-paragraph">
            {paragraph}
          </p>
        ))}
      </section>
    )
  }
  return (
    <section className="kitchen-cook-part">
      {heading}
      {part.items.length > 0 && (
        <div className="kitchen-cook-list" role="group" aria-labelledby={headingId}>
          {part.items.map((item, i) => (
            <label key={i} className="check-line kitchen-cook-item">
              <input type="checkbox" />
              <span className="check" aria-hidden="true" />
              {part.kind === 'steps' && (
                <>
                  <span className="kitchen-cook-number">{i + 1}</span>{' '}
                </>
              )}
              <span className="kitchen-cook-words">{item}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
