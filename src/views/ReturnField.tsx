/**
 * A field whose right edge says that Return adds what is in it.
 *
 * Four rows in this app add a thing when Return is pressed in the title -
 * quick-add, both template editors and the library's add line - and nothing
 * said so. The week rehearsal counted it: ninety-seven presses to build a
 * week when the controls are used as designed and a hundred and thirty-eight
 * when they are not, and twenty-two of the difference were reaching for the
 * Add button with the hand already on the keys.
 *
 * **Visible with nothing pressed.** A tooltip on the Add button was the
 * first answer and it is not one: a hint that needs a pointer resting on
 * something is a hint for somebody who already went looking. This sits in
 * the field, in the quietest ink the app has, and is on the screen from the
 * moment the row is.
 *
 * **Inside the field rather than beside it.** The room comes out of the
 * field's own padding, so the row's other controls do not move to make space
 * and the word can never be mistaken for a label on the control after it.
 * The mark takes no pointer events: pressing it is pressing the field.
 *
 * The visible word is the key's name and nothing else, because "Return adds"
 * inside a 320px column is a sentence where there is room for a word. What
 * it adds is what the field says - "Add a task", "What happens" - and the
 * button beside it is the same action spelled out. For a screen reader the
 * field carries `aria-keyshortcuts`, which is the same fact said in the one
 * way that surface has for saying it.
 */
export function ReturnField({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={className ? `return-field ${className}` : 'return-field'}>
      {children}
      {/* Hidden from anybody listening: they have aria-keyshortcuts on the
          field itself, and a loose "Return" read out after the field's name
          would be a riddle rather than a hint. */}
      <span className="return-mark" aria-hidden="true">
        Return
      </span>
    </span>
  )
}
