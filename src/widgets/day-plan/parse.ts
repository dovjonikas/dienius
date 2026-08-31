export function parseQuickAdd(input: string): { title: string; time?: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = /^([01]?\d|2[0-3]):([0-5]\d)\s+(.+)$/.exec(trimmed)
  if (match) {
    return { time: `${match[1].padStart(2, '0')}:${match[2]}`, title: match[3] }
  }
  return { title: trimmed }
}
