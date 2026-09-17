import { useEffect, useId, useRef } from 'react'
import { factsLine, fullMacroLine } from '../../lib/kitchen'
import { readRecipe, type RecipePart } from '../../lib/recipeText'
import type { Recipe } from '../../lib/types'

/**
 * A recipe, read - Kitchen, since v2.27.
 *
 * Kitchen at the top goes back to the list, and the recipe's actions stand at
 * the right of the same row: Edit. Under it, one card: the name, the numbers
 * for a serving and the facts on two quiet lines when there are any, then
 * the text as lib/recipeText.ts reads it - the lines before the headings as
 * they were typed, INGREDIENTS as a list, STEPS as numbered steps and any
 * other heading over its paragraphs, every part where it was written.
 *
 * The name takes the focus when the page opens, so a screen reader starts on
 * it and a long list scrolled down comes back to the top of the recipe.
 */
export function RecipePage({ recipe, onBack, onEdit }: { recipe: Recipe; onBack: () => void; onEdit: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const macros = fullMacroLine(recipe)
  const facts = factsLine(recipe)
  const reading = readRecipe(recipe.text)

  useEffect(() => {
    titleRef.current?.focus()
  }, [recipe.id])

  return (
    <>
      <div className="library-header kitchen-head">
        <button type="button" className="btn-quiet kitchen-back" onClick={onBack}>
          <span className="kitchen-back-caret" aria-hidden="true" />
          Kitchen
        </button>
        <div className="kitchen-head-actions">
          <button type="button" className="btn-quiet" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      <article className="library-list kitchen-recipe" aria-labelledby={titleId}>
        <header className="kitchen-recipe-head">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="kitchen-recipe-title">
            {recipe.title}
          </h2>
          {macros && <p className="kitchen-recipe-line">{macros}</p>}
          {facts && <p className="kitchen-recipe-line">{facts}</p>}
        </header>

        {reading.intro.length > 0 && (
          <div className="kitchen-recipe-intro">
            {reading.intro.map((paragraph, i) => (
              <p key={i} className="kitchen-paragraph">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {reading.parts.map((part, i) => (
          <RecipePartView key={i} part={part} />
        ))}
      </article>
    </>
  )
}

/** A heading as the page shows it: as typed, without a colon at its end. */
function shownHeading(heading: string): string {
  return heading.replace(/\s*:$/, '')
}

/** One part under its heading: the ingredients, the steps, or paragraphs. */
function RecipePartView({ part }: { part: RecipePart }) {
  const headingId = useId()
  const heading = (
    <h3 id={headingId} className="kitchen-part-heading">
      {shownHeading(part.heading)}
    </h3>
  )
  if (part.kind === 'section') {
    return (
      <section className="kitchen-part">
        {heading}
        {part.paragraphs.map((paragraph, i) => (
          <p key={i} className="kitchen-paragraph">
            {paragraph}
          </p>
        ))}
      </section>
    )
  }
  if (part.items.length === 0) {
    return <section className="kitchen-part">{heading}</section>
  }
  const items = part.items.map((item, i) => <li key={i}>{item}</li>)
  return (
    <section className="kitchen-part">
      {heading}
      {part.kind === 'steps' ? (
        <ol className="kitchen-steps" aria-labelledby={headingId}>
          {items}
        </ol>
      ) : (
        <ul className="kitchen-ingredients" aria-labelledby={headingId}>
          {items}
        </ul>
      )}
    </section>
  )
}
