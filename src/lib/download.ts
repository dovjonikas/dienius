/**
 * A text handed to the browser as a file to save.
 *
 * The one way the app gives somebody a file: Export backup, the templates
 * file, a plan that could not be read, and the backup a screen that failed
 * offers. It was written out three times before there were five.
 *
 * The object URL is let go a tick later rather than at once: WebKit starts
 * reading the blob after the click has returned, and revoking it in the
 * same tick gave an empty or failed download on iOS Safari.
 */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
