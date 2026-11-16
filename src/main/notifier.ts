import { Notification } from 'electron'
import { addDays, startOfWeek } from '@shared/dates'
import { loadWeek, REFRESH_INTERVAL_MS } from './events'
import * as store from './store'
import type { CalendarEvent } from '@shared/types'

const CHECK_INTERVAL_MS = 30 * 1000
/** A "when it starts" reminder still shows if the app notices up to this late (e.g. after sleep) */
const START_GRACE_MS = 2 * 60 * 1000
/** While offline, try again this often instead of every 5 minutes */
const OFFLINE_RETRY_MS = 30 * 1000

let nextSync: ReturnType<typeof setTimeout> | undefined

interface Options {
  icon: string
  /** Bring the window up on this meeting */
  openEvent(key: string, start: string): void
  /** Called after every sync, e.g. to update the tray menu */
  onSynced(): void
}

let opts: Options
let upcoming: CalendarEvent[] = []
/** "start|minutes|key" of reminders already shown or skipped, so each one fires once */
const notified = new Set<string>()
/** Keep shown notifications referenced so their click handlers survive garbage collection */
const shown = new Set<Notification>()

const startMs = (e: CalendarEvent): number => new Date(e.start).getTime()

/** The account's label if it has one, otherwise its email */
const accountName = (email: string): string => store.getAccounts().find((a) => a.email === email)?.label ?? email

export async function sync(force = true): Promise<void> {
  let offline = false
  if (!store.getAccounts().length) {
    upcoming = []
  } else {
    const thisWeek = startOfWeek(new Date())
    try {
      const weeks = await Promise.all([
        loadWeek(thisWeek.toISOString(), force),
        loadWeek(addDays(thisWeek, 7).toISOString(), force)
      ])
      offline = weeks.some((w) => w.offline)
      upcoming = weeks
        .flatMap((w) => w.events)
        .filter((e) => !e.allDay)
        .sort((a, b) => startMs(a) - startMs(b))
    } catch {
      // Keep the previous list; the next sync will try again
      offline = true
    }
  }
  // Retry soon while offline, otherwise the normal 5-minute rhythm
  clearTimeout(nextSync)
  nextSync = setTimeout(() => void sync(), offline ? OFFLINE_RETRY_MS : REFRESH_INTERVAL_MS)
  opts.onSynced()
  check()
}

function relative(minutes: number): string {
  if (minutes <= 0) return 'starting now'
  if (minutes === 1) return 'in 1 min'
  return `in ${minutes} min`
}

export function show(title: string, body: string, onClick: () => void): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, icon: opts.icon })
  shown.add(n)
  n.on('click', () => {
    shown.delete(n)
    onClick()
  })
  n.on('close', () => shown.delete(n))
  n.show()
}

function check(): void {
  const settings = store.getSettings()
  const now = Date.now()
  for (const id of notified) {
    if (Number(id.split('|')[0]) + START_GRACE_MS < now) notified.delete(id)
  }
  if (!settings.notifications) return

  for (const e of upcoming) {
    const start = startMs(e)
    if (start + START_GRACE_MS < now) continue
    // Reminders whose time has come, largest first. Once the meeting starts only "when it starts" is left.
    const due = settings.reminders.filter((m) => (m > 0 ? now >= start - m * 60_000 && now < start : now >= start))
    const ids = due.map((m) => `${start}|${m}|${e.key}`)
    // Several can be due at once (e.g. the app just opened); show only the latest one
    if (!ids.length || notified.has(ids[ids.length - 1])) continue
    for (const id of ids) notified.add(id)
    const time = new Date(start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    show(
      `${e.title} ${relative(Math.round((start - now) / 60_000))}`,
      `${time} · ${e.calendarName} (${accountName(e.accountEmail)})${e.meetingLink ? '\nClick to see details and join' : ''}`,
      () => opts.openEvent(e.key, e.start)
    )
  }
}

/** The meeting happening now or coming up next. */
export function nextMeeting(): CalendarEvent | undefined {
  const now = Date.now()
  return upcoming.find((e) => new Date(e.end).getTime() > now)
}

/** "30 min before, 10 min before and when it starts" */
function describeReminders(reminders: number[]): string {
  const parts = reminders.map((m) => (m === 0 ? 'when it starts' : `${m} min before`))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
}

export function showTest(): void {
  const when = describeReminders(store.getSettings().reminders)
  show('Notifications are working', `You'll get a reminder ${when}.`, () => {})
}

export function start(options: Options): void {
  opts = options
  // Each sync schedules the next one
  void sync(false)
  setInterval(check, CHECK_INTERVAL_MS)
}
