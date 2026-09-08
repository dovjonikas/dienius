import { expect, test } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * A screenshot into a note, in a real browser, because every interesting
 * part of it is a browser: the clipboard carrying a file, a canvas
 * shrinking and re-encoding it, and IndexedDB holding the result.
 *
 * What this proves that the unit tests cannot: the picture really is
 * smaller than the one that was pasted, it really is in IndexedDB, and the
 * state that goes to sync and into the backup really does not contain it.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test.beforeEach(async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))
})

/** Draws a 2400x1600 PNG in the page and pastes it as a clipboard file. */
async function pasteAPicture(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 1600
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2b6cb0'
    ctx.fillRect(0, 0, 2400, 1600)
    ctx.fillStyle = '#ffffff'
    ctx.font = '120px sans-serif'
    ctx.fillText('MEAL PLAN', 160, 400)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob!], 'shot.png', { type: 'image/png' })
    const data = new DataTransfer()
    data.items.add(file)
    document
      .querySelector('.scratch-input')!
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
}

test('a pasted screenshot is shrunk, kept in IndexedDB, and never in the state', async ({ page }) => {
  await page.keyboard.press('s')
  const scratch = page.getByRole('dialog', { name: 'Notes' })
  await scratch.getByRole('textbox', { name: 'Note' }).pressSequentially('the meal plan')

  await pasteAPicture(page)
  await expect(scratch.getByRole('status')).toContainText('Picture added.')
  await expect(scratch.getByRole('button', { name: 'Open the picture' })).toBeVisible()

  // The longer edge came down to 1600 and the file was re-encoded, so what
  // is stored is a fraction of what was pasted - see lib/photos.ts.
  const kept = await page.evaluate(
    () =>
      new Promise<{ bytes: number; type: string }[]>(resolve => {
        const request = indexedDB.open('dienius-photos', 1)
        request.onsuccess = () => {
          const all = request.result.transaction('photos', 'readonly').objectStore('photos').getAll()
          all.onsuccess = () => resolve(all.result.map((b: Blob) => ({ bytes: b.size, type: b.type })))
        }
      }),
  )
  expect(kept).toHaveLength(1)
  expect(kept[0].type).toBe('image/jpeg')
  expect(kept[0].bytes).toBeLessThan(400_000)

  const state = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dienius:data') ?? '{}')
    return { photos: data.scratch[0].photos, raw: JSON.stringify(data) }
  })
  expect(state.photos).toEqual([{ id: expect.any(String), width: 1600, height: 1067 }])
  expect(state.raw).not.toContain('data:image')
  expect(state.raw).not.toContain('base64')
})

test('a picture opens full screen, walks nowhere on its own, and Escape brings the note back', async ({ page }) => {
  await page.keyboard.press('s')
  const scratch = page.getByRole('dialog', { name: 'Notes' })
  await scratch.getByRole('textbox', { name: 'Note' }).pressSequentially('a whiteboard')
  await pasteAPicture(page)

  await scratch.getByRole('button', { name: 'Open the picture' }).click()
  const viewer = page.getByRole('dialog', { name: 'Picture' })
  await expect(viewer.locator('img')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  // Escape closed the picture and not the note under it.
  await expect(scratch).toBeVisible()
})

test('the cross takes the picture off the note and out of the database', async ({ page }) => {
  await page.keyboard.press('s')
  const scratch = page.getByRole('dialog', { name: 'Notes' })
  await scratch.getByRole('textbox', { name: 'Note' }).pressSequentially('a receipt')
  await pasteAPicture(page)
  await expect(scratch.getByRole('button', { name: 'Open the picture' })).toBeVisible()

  await scratch.getByRole('button', { name: /^Remove picture/ }).click()
  await expect(scratch.getByRole('button', { name: 'Open the picture' })).toHaveCount(0)

  const left = await page.evaluate(
    () =>
      new Promise<number>(resolve => {
        const request = indexedDB.open('dienius-photos', 1)
        request.onsuccess = () => {
          const all = request.result.transaction('photos', 'readonly').objectStore('photos').getAllKeys()
          all.onsuccess = () => resolve(all.result.length)
        }
      }),
  )
  expect(left).toBe(0)
})
