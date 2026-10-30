/**
 * Puts the items in the order of `emails`. Items not mentioned keep their relative order at the end,
 * and unknown emails are ignored, so a stale order can never drop or duplicate an account.
 */
export function reorderByEmail<T extends { email: string }>(items: T[], emails: string[]): T[] {
  const byEmail = new Map(items.map((i) => [i.email, i]))
  const ordered = [...new Set(emails)].map((e) => byEmail.get(e)).filter((i): i is T => Boolean(i))
  const rest = items.filter((i) => !ordered.includes(i))
  return [...ordered, ...rest]
}

/** Moves the item at index `from` so it ends up at index `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
