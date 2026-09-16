import { useState } from 'react'

/**
 * The one control that destroys a template, inside the editor of the
 * template it destroys.
 *
 * It sat on every row of the list until v2.22, outlined in the danger colour
 * beside each Edit, so a page of three templates had three red buttons on it
 * before anybody had pressed anything - the loudest thing on a screen whose
 * one job is New template. Deleting is rarer than opening by a hundred to
 * one, and the place a person is sure which template they mean is inside
 * it. So: one press opens the template, and the delete is at the far end of
 * its own footer, outlined until armed and filled once armed, the two
 * states CONVENTIONS section 6 describes. A second press deletes; focus
 * leaving disarms.
 */
export function DeleteTemplateButton({ name, onDelete }: { name: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      className={armed ? 'btn-danger is-armed delete-template' : 'btn-danger delete-template'}
      aria-label={armed ? `Confirm delete ${name}` : `Delete ${name}`}
      onClick={() => {
        if (armed) onDelete()
        else setArmed(true)
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Delete?' : 'Delete template'}
    </button>
  )
}
