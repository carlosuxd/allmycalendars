import * as google from './google'
import * as store from './store'
import type { EventsResult } from '@shared/types'

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000
/** Last-resort limit for a whole week's fetch, on top of the per-request timeouts */
const WEEK_TIMEOUT_MS = 45_000

/** One request per week at a time, shared by the window and the notifier. */
const inFlight = new Map<string, Promise<EventsResult>>()

/** fetchWeek, but never left hanging: after WEEK_TIMEOUT_MS every account counts as failed */
function fetchWeekWithTimeout(weekStartIso: string): Promise<EventsResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<EventsResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          events: [],
          errors: store.getAccounts().map((a) => ({ accountEmail: a.email, message: 'Timed out' })),
          fetchedAt: new Date().toISOString(),
          fromCache: false
        }),
      WEEK_TIMEOUT_MS
    )
  })
  return Promise.race([google.fetchWeek(weekStartIso), timedOut]).finally(() => clearTimeout(timer))
}

async function fetchAndCache(weekStartIso: string): Promise<EventsResult> {
  const cached = store.getCached(weekStartIso)
  const result = await fetchWeekWithTimeout(weekStartIso)
  const everyAccountFailed = result.errors.length > 0 && result.errors.length >= store.getAccounts().length
  if (everyAccountFailed) {
    // Probably offline: show what we had last time. Never saved, so the flag clears on the next good sync.
    return cached ? { ...cached, errors: result.errors, fromCache: true, offline: true } : { ...result, offline: true }
  }
  store.setCached(weekStartIso, result)
  return result
}

export async function loadWeek(weekStartIso: string, force = false): Promise<EventsResult> {
  const cached = store.getCached(weekStartIso)
  // Serve cache instantly if it is fresh enough and nobody asked for a refresh
  if (!force && cached && Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_INTERVAL_MS) {
    return { ...cached, fromCache: true }
  }
  let pending = inFlight.get(weekStartIso)
  if (!pending) {
    pending = fetchAndCache(weekStartIso).finally(() => inFlight.delete(weekStartIso))
    inFlight.set(weekStartIso, pending)
  }
  return pending
}
