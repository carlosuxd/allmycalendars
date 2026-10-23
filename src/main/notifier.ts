import { Notification } from 'electron'
import { addDays, startOfWeek } from '@shared/dates'
import { loadWeek, REFRESH_INTERVAL_MS } from './events'
import * as store from './store'
import type { CalendarEvent } from '@shared/types'

const CHECK_INTERVAL_MS = 30 * 1000

interface Options {
  icon: string
  /** Bring the window up on this meeting */
  openEvent(key: string, start: string): void
  /** Called after every sync, e.g. to update the tray menu */
  onSynced(): void
}

let opts: Options
let upcoming: CalendarEvent[] = []
/** "key|start" of meetings already notified, so each one fires once */
const notified = new Set<string>()
/** Keep shown notifications referenced so their click handlers survive garbage collection */
const shown = new Set<Notification>()

const startMs = (e: CalendarEvent): number => new Date(e.start).getTime()

/** The account's label if it has one, otherwise its email */
const accountName = (email: string): string => store.getAccounts().find((a) => a.email === email)?.label ?? email

export async function sync(force = true): Promise<void> {
  if (!store.getAccounts().length) {
    upcoming = []
  } else {
    const thisWeek = startOfWeek(new Date())
    try {
      const weeks = await Promise.all([
        loadWeek(thisWeek.toISOString(), force),
        loadWeek(addDays(thisWeek, 7).toISOString(), force)
      ])
      upcoming = weeks
        .flatMap((w) => w.events)
        .filter((e) => !e.allDay)
        .sort((a, b) => startMs(a) - startMs(b))
    } catch {
      // Keep the previous list; the next sync will try again
    }
  }
  opts.onSynced()
  check()
}

function relative(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes === 1) return 'in 1 min'
  return `in ${minutes} min`
}

function show(title: string, body: string, onClick: () => void): void {
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
    if (Number(id.split('|').pop()) < now) notified.delete(id)
  }
  if (!settings.notifications) return

  for (const e of upcoming) {
    const start = startMs(e)
    const id = `${e.key}|${start}`
    if (start <= now || start - settings.leadMinutes * 60_000 > now || notified.has(id)) continue
    notified.add(id)
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

export function showTest(): void {
  const lead = store.getSettings().leadMinutes
  show('Notifications are working', `You'll be notified ${lead} min before each meeting.`, () => {})
}

export function start(options: Options): void {
  opts = options
  void sync(false)
  setInterval(() => void sync(), REFRESH_INTERVAL_MS)
  setInterval(check, CHECK_INTERVAL_MS)
}
