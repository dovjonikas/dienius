import { useEffect, useState } from 'react'
import { systemPrefersDark } from './theme'

/**
 * Tracks the live `prefers-color-scheme` result, the same way App.tsx's own
 * theme effect does, so anything rendering a 'system' mode preview - the
 * gallery, the override panel - shows the variant that would actually paint
 * right now rather than whatever it was on first mount. Wrapped in the same
 * try/catch for the same reason - matchMedia is not guaranteed to exist
 * everywhere this runs (jsdom in tests included, where it throws and this
 * simply keeps the initial systemPrefersDark() reading of false).
 */
export function useSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(systemPrefersDark)

  useEffect(() => {
    try {
      const query = window.matchMedia('(prefers-color-scheme: dark)')
      const update = () => setDark(query.matches)
      update()
      query.addEventListener('change', update)
      return () => query.removeEventListener('change', update)
    } catch {
      return undefined
    }
  }, [])

  return dark
}
