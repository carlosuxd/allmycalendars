import { calendar, type calendar_v3 } from '@googleapis/calendar'
import { clientFor } from './auth'
import * as store from './store'
import type { CalendarEvent, CalendarInfo, EventsResult } from '@shared/types'

function api(email: string): calendar_v3.Calendar {
  // @googleapis/calendar may bundle its own copy of google-auth-library, hence the cast.
  return calendar({ version: 'v3', auth: clientFor(email) as never })
}

export async function fetchCalendars(email: string): Promise<CalendarInfo[]> {
  const items: calendar_v3.Schema$CalendarListEntry[] = []
  let pageToken: string | undefined
  do {
    const res = await api(email).calendarList.list({ pageToken, maxResults: 250 })
    items.push(...(res.data.items ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items
    .filter((c) => c.id && !c.deleted)
    .map((c) => ({
      id: c.id!,
      accountEmail: email,
      name: c.summaryOverride ?? c.summary ?? c.id!,
      color: c.backgroundColor ?? '#4f7cff',
      // Start with the calendars the user already shows in Google Calendar
      enabled: Boolean(c.selected || c.primary),
      primary: Boolean(c.primary)
    }))
}

export async function refreshAllCalendars(): Promise<CalendarInfo[]> {
  await Promise.all(
    store.getAccounts().map(async ({ email }) => store.setAccountCalendars(email, await fetchCalendars(email)))
  )
  return store.getCalendars()
}

const LINK_PATTERNS = [
  /https:\/\/meet\.google\.com\/[a-z0-9-]+/i,
  /https:\/\/[\w.-]*zoom\.us\/(?:j|my|w)\/[^\s"'<>]+/i,
  /https:\/\/teams\.microsoft\.com\/(?:l\/meetup-join|meet)\/[^\s"'<>]+/i,
  /https:\/\/teams\.live\.com\/meet\/[^\s"'<>]+/i,
  /https:\/\/[\w.-]*webex\.com\/[^\s"'<>]+/i,
  /https:\/\/whereby\.com\/[^\s"'<>]+/i
]

export function findMeetingLink(e: calendar_v3.Schema$Event): string | undefined {
  if (e.hangoutLink) return e.hangoutLink
  const video = e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri
  if (video) return video
  const text = `${e.location ?? ''}\n${e.description ?? ''}`
  for (const re of LINK_PATTERNS) {
    const m = text.match(re)
    if (m) return m[0].replace(/&amp;/g, '&')
  }
  return undefined
}

/** Google event descriptions are light HTML; turn them into plain text. */
function toPlainText(html?: string | null): string | undefined {
  if (!html) return undefined
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_, href, text) => (text === href ? href : `${text} (${href})`))
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toEvent(e: calendar_v3.Schema$Event, cal: CalendarInfo): CalendarEvent {
  const allDay = Boolean(e.start?.date)
  return {
    key: `${cal.accountEmail}|${cal.id}|${e.id}`,
    iCalUID: e.iCalUID ?? undefined,
    title: e.summary || '(No title)',
    start: (allDay ? e.start?.date : e.start?.dateTime) ?? '',
    end: (allDay ? e.end?.date : e.end?.dateTime) ?? '',
    allDay,
    location: e.location ?? undefined,
    description: toPlainText(e.description),
    meetingLink: findMeetingLink(e),
    htmlLink: e.htmlLink ?? undefined,
    attendees: (e.attendees ?? []).map((a) => ({
      email: a.email ?? '',
      name: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
      self: a.self ?? undefined
    })),
    organizer: e.organizer?.displayName ?? e.organizer?.email ?? undefined,
    color: cal.color,
    calendarName: cal.name,
    accountEmail: cal.accountEmail,
    alsoIn: []
  }
}

async function fetchCalendarEvents(cal: CalendarInfo, timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = []
  let pageToken: string | undefined
  do {
    const res = await api(cal.accountEmail).events.list({
      calendarId: cal.id,
      timeMin,
      timeMax,
      singleEvents: true, // expand recurring events
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken
    })
    for (const e of res.data.items ?? []) {
      if (e.status === 'cancelled') continue
      if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue
      out.push(toEvent(e, cal))
    }
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return out
}

/** The same meeting often shows up in several of your accounts; keep one copy. */
function dedupe(events: CalendarEvent[]): CalendarEvent[] {
  const byId = new Map<string, CalendarEvent>()
  const result: CalendarEvent[] = []
  for (const e of events) {
    if (!e.iCalUID) {
      result.push(e)
      continue
    }
    const id = `${e.iCalUID}|${new Date(e.start).getTime()}`
    const first = byId.get(id)
    if (!first) {
      byId.set(id, e)
      result.push(e)
    } else {
      if (!first.meetingLink && e.meetingLink) first.meetingLink = e.meetingLink
      if (first.accountEmail !== e.accountEmail && !first.alsoIn.includes(e.accountEmail)) first.alsoIn.push(e.accountEmail)
    }
  }
  return result
}

export async function fetchWeek(weekStartIso: string): Promise<EventsResult> {
  const start = new Date(weekStartIso)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const timeMin = start.toISOString()
  const timeMax = end.toISOString()

  // Fetch calendar lists the first time we see an account
  const known = new Set(store.getCalendars().map((c) => c.accountEmail))
  const errors: EventsResult['errors'] = []
  await Promise.all(
    store
      .getAccounts()
      .filter((a) => !known.has(a.email))
      .map(async ({ email }) => {
        try {
          store.setAccountCalendars(email, await fetchCalendars(email))
        } catch (err) {
          errors.push({ accountEmail: email, message: (err as Error).message })
        }
      })
  )

  // Primary calendars first, so de-duplication keeps the copy from your own calendar
  const calendars = store
    .getCalendars()
    .filter((c) => c.enabled)
    .sort((a, b) => Number(b.primary) - Number(a.primary))

  const lists = await Promise.all(
    calendars.map(async (cal) => {
      try {
        return await fetchCalendarEvents(cal, timeMin, timeMax)
      } catch (err) {
        if (!errors.some((x) => x.accountEmail === cal.accountEmail)) {
          errors.push({ accountEmail: cal.accountEmail, message: (err as Error).message })
        }
        return []
      }
    })
  )

  return {
    events: dedupe(lists.flat()),
    errors,
    fetchedAt: new Date().toISOString(),
    fromCache: false
  }
}
