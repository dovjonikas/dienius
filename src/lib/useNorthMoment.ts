import { useEffect, useState } from 'react'
import { northMoment, type NorthMoment } from './northLine'
import { NORTH_WOKE_EVENT, northWokeAt } from './northRead'

/**
 * Which part of the day North's line is for, kept current: read from the
 * clock and the last waking on this device, and read again every minute,
 * when the app comes back into view, and the moment a waking is written -
 * so the morning's line is on the day the first time it is looked at after
 * sleep, and the evening's comes on at 21:00 without a reload.
 */
export function useNorthMoment(): NorthMoment {
  const [moment, setMoment] = useState<NorthMoment>(() => northMoment(Date.now(), northWokeAt()))

  useEffect(() => {
    const update = () => setMoment(northMoment(Date.now(), northWokeAt()))
    update()
    window.addEventListener(NORTH_WOKE_EVENT, update)
    document.addEventListener('visibilitychange', update)
    const tick = window.setInterval(update, 60_000)
    return () => {
      window.removeEventListener(NORTH_WOKE_EVENT, update)
      document.removeEventListener('visibilitychange', update)
      window.clearInterval(tick)
    }
  }, [])

  return moment
}
