import { MAX_HIGHLIGHTS } from '../lib/types'

/**
 * Whether a block may be marked KEY, and what to say when it may not.
 *
 * The cap is `MAX_HIGHLIGHTS` per **day**, which is the only unit it has ever
 * meant: on a day template that is the template, and on a week template it is
 * one column - so a block added to five days is asked the question five
 * times, once for each. A block put on a day where three things already
 * matter is refused, and the refusal names those three, because "no" without
 * "these three are already there" is the app being obstinate rather than
 * being a colleague. `actions.toggleTaskHighlight` refuses on the day for the
 * same reason and in the same words.
 *
 * Taking KEY off always works, here as there.
 */
export interface KeyCandidate {
  id: string
  title: string
  time?: string
  highlight?: boolean
}

export interface KeyVerdict {
  allowed: boolean
  /** The three already there, in the order they happen, when it is a no. */
  blocking: string[]
  /** A sentence to show, or nothing when the answer is yes. */
  message?: string
}

/**
 * @param onTheDay every block on the day this one would be marked on,
 *   including the block itself
 * @param block the one being marked
 */
export function canMarkKey(onTheDay: KeyCandidate[], block: KeyCandidate): KeyVerdict {
  if (block.highlight) return { allowed: true, blocking: [] }
  const marked = onTheDay.filter(b => b.highlight && b.id !== block.id)
  if (marked.length < MAX_HIGHLIGHTS) return { allowed: true, blocking: [] }
  const blocking = [...marked]
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    .map(b => b.title)
  return {
    allowed: false,
    blocking,
    message: `${MAX_HIGHLIGHTS} already matter here: ${blocking.join(', ')}. Take one off first.`,
  }
}
