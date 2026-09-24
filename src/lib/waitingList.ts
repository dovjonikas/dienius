import type { LibraryList, Template } from './types'
import { sameName } from './recipeImport'

/**
 * Template blocks waiting for a Library list by name - the owner's brief of
 * 2026-09-25, the extra stage.
 *
 * A templates file names the list a reading block reads from
 * (docs/TEMPLATE-JSON.md, `library`), and is pasted before the shelf it
 * names as often as after it. A name the Library does not have yet is kept
 * on the block (`TemplateBlock.waitingLibrary`) instead of dropped, and the
 * block reads from the list as soon as the Library has one of that name -
 * pasted many at once, made by hand, or renamed into it - found the way the
 * import finds one: the same words, whatever their case or spacing
 * (`sameName`). The recipes a meal block waits for are the same rule
 * (lib/waitingRecipes.ts).
 *
 * A day already stamped from the block names the list's book when it is
 * next opened, as it takes any change to its template (`refreshFromTemplate`).
 */
export function joinWaitingLists(templates: Template[], library: readonly LibraryList[]): Template[] {
  let changed = false
  const next = templates.map(template => {
    if (!template.blocks.some(b => b.waitingLibrary)) return template
    let touched = false
    const blocks = template.blocks.map(block => {
      if (!block.waitingLibrary) return block
      const list = library.find(l => sameName(l.name, block.waitingLibrary!))
      if (!list) return block
      touched = true
      const { waitingLibrary: _waited, ...rest } = block
      return { ...rest, libraryListId: list.id }
    })
    if (!touched) return template
    changed = true
    return { ...template, blocks }
  })
  return changed ? next : templates
}
