import { expect, test } from '@playwright/test'
import { openFreshAt, wednesdayAt } from './app'

/**
 * The palette's door, pressed rather than typed.
 *
 * Ctrl K was the only way into the palette from the day it was built, which
 * on a phone is no way in at all. The header carries a Search button now -
 * see DECISIONS "The palette has a door a finger can press" - and this
 * presses it on the phone's own viewport as well as the desktop's: the
 * palette opens with the typing already in it, and a command chosen there
 * runs. The command is Something came up, whose sheet the interrupt test
 * already walks; here it only has to appear.
 */

test.use({ timezoneId: 'Europe/Vilnius' })

test('a press on Search opens the palette, and a command chosen in it runs', async ({ page }) => {
  await openFreshAt(page, wednesdayAt(10))

  const door = page.getByRole('button', { name: 'Search', exact: true })
  await expect(door).toHaveAttribute('aria-expanded', 'false')
  await door.click()

  const palette = page.getByRole('dialog', { name: 'Commands and search' })
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('combobox')).toBeFocused()
  await expect(door).toHaveAttribute('aria-expanded', 'true')

  await palette.getByRole('combobox').fill('came up')
  await palette.getByRole('option', { name: /^Something came up/ }).click()

  const sheet = page.getByRole('dialog', { name: 'Replan' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { name: 'Something came up' })).toBeVisible()
  await expect(palette).toHaveCount(0)
})
