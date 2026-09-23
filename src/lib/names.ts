/**
 * What a recipe or a template with no name is called on the screen.
 *
 * The app never makes one - both editors want a name before they save, and
 * a templates file or a pasted shelf of recipes skips a line without one -
 * but a backup edited by hand can hold either with an empty name, and the
 * guard lets it in: refusing the whole file for one blank name would lose
 * everything else in it. It stays empty in the plan, because a name is the
 * person's to give and a file imported and exported again is the same
 * file. On the screen it is called what it is, so its row is something to
 * read and to press rather than a blank. The freeze's point 2.
 */
export const UNTITLED_RECIPE = 'Untitled recipe'
export const UNTITLED_TEMPLATE = 'Untitled template'

export function recipeTitle(recipe: { title: string }): string {
  return recipe.title.trim() ? recipe.title : UNTITLED_RECIPE
}

export function templateName(template: { name: string }): string {
  return template.name.trim() ? template.name : UNTITLED_TEMPLATE
}
