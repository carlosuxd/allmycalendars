import type { CalendarEvent } from '@shared/types'
import { addDays } from '@shared/dates'

export { addDays, startOfDay, startOfWeek } from '@shared/dates'

export const DAY_MS = 24 * 60 * 60 * 1000

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** All-day dates are "YYYY-MM-DD" and must be read as local dates, not UTC. */
export function parseEventDate(value: string, allDay: boolean): Date {
  if (allDay) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export const eventStart = (e: CalendarEvent): Date => parseEventDate(e.start, e.allDay)
export const eventEnd = (e: CalendarEvent): Date => parseEventDate(e.end, e.allDay)

export const fmtTime = (d: Date): string => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function fmtRange(e: CalendarEvent): string {
  const s = eventStart(e)
  const end = eventEnd(e)
  const day = (d: Date): string => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  if (e.allDay) {
    const last = addDays(end, -1)
    return sameDay(s, last) ? `${day(s)} · All day` : `${day(s)} – ${day(last)}`
  }
  return sameDay(s, end) ? `${day(s)} · ${fmtTime(s)} – ${fmtTime(end)}` : `${day(s)} ${fmtTime(s)} – ${day(end)} ${fmtTime(end)}`
}

/** Title for the visible days: "October 19 – 25, 2026", or "Oct 23 – 24" when compact. */
export function fmtRangeTitle(days: Date[], compact: boolean): string {
  const first = days[0]
  const last = days[days.length - 1]
  const month = (d: Date): string => d.toLocaleDateString(undefined, { month: compact ? 'short' : 'long' })
  const a = `${month(first)} ${first.getDate()}`
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
  const b = sameMonth ? `${last.getDate()}` : `${month(last)} ${last.getDate()}`
  if (compact) return `${a} – ${b}`
  if (first.getFullYear() !== last.getFullYear()) return `${a}, ${first.getFullYear()} – ${b}, ${last.getFullYear()}`
  return `${a} – ${b}, ${last.getFullYear()}`
}
