import * as google from './google'
import * as store from './store'
import type { EventsResult } from '@shared/types'

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

/** One request per week at a time, shared by the window and the notifier. */
const inFlight = new Map<string, Promise<EventsResult>>()

async function fetchAndCache(weekStartIso: string): Promise<EventsResult> {
  const cached = store.getCached(weekStartIso)
  const result = await google.fetchWeek(weekStartIso)
  const everyAccountFailed = result.errors.length > 0 && result.errors.length >= store.getAccounts().length
  if (everyAccountFailed && cached) {
    // Probably offline: show what we had last time
    return { ...cached, errors: result.errors, fromCache: true }
  }
  if (!everyAccountFailed) store.setCached(weekStartIso, result)
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
