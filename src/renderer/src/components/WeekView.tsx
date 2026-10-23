import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { VideoCameraIcon } from '@phosphor-icons/react'
import type { Account, CalendarEvent } from '@shared/types'
import { accountFullName } from '../accounts'
import { DAY_MS, eventEnd, eventStart, fmtTime, sameDay } from '../dates'
import { accountDotColor, chipColors, eventColors, useDarkMode } from '../color'

const HOUR_PX = 52
const MIN_EVENT_PX = 20

interface Placed {
  event: CalendarEvent
  top: number
  height: number
  col: number
  cols: number
}

/** Lays out one day's timed events side by side where they overlap. */
function layoutDay(events: CalendarEvent[], day: Date): Placed[] {
  const dayStart = day.getTime()
  const items = events
    .map((event) => {
      const s = Math.max(eventStart(event).getTime(), dayStart)
      const e = Math.min(eventEnd(event).getTime(), dayStart + DAY_MS)
      return { event, s, e: Math.max(e, s + 15 * 60 * 1000) }
    })
    .sort((a, b) => a.s - b.s || b.e - a.e)

  const placed: Placed[] = []
  let cluster: (Placed & { e: number })[] = []
  let clusterEnd = 0
  const flush = (): void => {
    const cols = Math.max(...cluster.map((p) => p.col)) + 1
    for (const p of cluster) placed.push({ ...p, cols })
    cluster = []
  }

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush()
    const busy = new Set(cluster.filter((p) => p.e > it.s).map((p) => p.col))
    let col = 0
    while (busy.has(col)) col++
    const top = ((it.s - dayStart) / 3_600_000) * HOUR_PX
    const height = Math.max(((it.e - it.s) / 3_600_000) * HOUR_PX, MIN_EVENT_PX)
    cluster.push({ event: it.event, top, height, col, cols: 1, e: it.e })
    clusterEnd = Math.max(clusterEnd, it.e)
  }
  if (cluster.length) flush()
  return placed
}

/** Shows which account an item belongs to, in that account's sidebar color. */
function AccountDot({ name }: { name: string }): JSX.Element {
  return <span className="account-dot" role="img" aria-label={`Account: ${name}`} title={name} />
}

function MeetIcon(): JSX.Element {
  return (
    <VideoCameraIcon className="meet-icon" size={12} weight="fill" role="img" aria-label="Has meeting link">
      <title>Has meeting link</title>
    </VideoCameraIcon>
  )
}

interface Props {
  /** The days to show, in order (2–7) */
  days: Date[]
  events: CalendarEvent[]
  /** The signed-in accounts, for each item's dot color and account name */
  accounts: Account[]
  selectedKey?: string
  onSelect(e: CalendarEvent): void
}

export function WeekView({ days, events, accounts, selectedKey, onSelect }: Props): JSX.Element {
  const accountOf = (e: CalendarEvent): Account | undefined => accounts.find((a) => a.email === e.accountEmail)
  const accountColor = (e: CalendarEvent): string => accountOf(e)?.color ?? e.color
  const [now, setNow] = useState(new Date())
  const scroller = useRef<HTMLDivElement>(null)
  const dark = useDarkMode()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Start scrolled to the working day
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7.5 * HOUR_PX
  }, [])

  const allDay = events.filter((e) => e.allDay)
  const timed = events.filter((e) => !e.allDay)

  return (
    <div className="week">
      <div className="week-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`day-head ${sameDay(d, now) ? 'today' : ''}`}>
            <span className="dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span className="dom">{d.getDate()}</span>
          </div>
        ))}
      </div>

      <div className="allday-row">
        <div className="gutter label">all-day</div>
        {days.map((d) => {
          const dayEvents = allDay.filter((e) => eventStart(e) <= d && eventEnd(e) > d)
          return (
            <div key={d.toISOString()} className="allday-cell">
              {dayEvents.map((e) => {
                const chip = chipColors(e.color)
                const dot = accountDotColor(accountColor(e), dark)
                return (
                  <button
                    key={e.key}
                    className={`chip ${selectedKey === e.key ? 'selected' : ''}`}
                    style={{ '--chip-bg': chip.bg, '--chip-fg': chip.fg, '--dot': dot } as CSSProperties}
                    onClick={() => onSelect(e)}
                    title={e.title}
                  >
                    <AccountDot name={accountFullName(accountOf(e), e.accountEmail)} />
                    <span className="chip-title">{e.title}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="grid-scroll" ref={scroller}>
        <div className="grid" style={{ height: 24 * HOUR_PX }}>
          <div className="gutter hours">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="hour-label" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayEnd = d.getTime() + DAY_MS
            const dayEvents = timed.filter((e) => eventStart(e).getTime() < dayEnd && eventEnd(e).getTime() > d.getTime())
            const isToday = sameDay(d, now)
            return (
              <div key={d.toISOString()} className={`day-col ${isToday ? 'today' : ''}`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="hour-line" style={{ top: h * HOUR_PX }} />
                ))}
                {layoutDay(dayEvents, d).map(({ event: e, top, height, col, cols }) => {
                  const past = eventEnd(e) < now
                  const compact = height < 36
                  const colors = eventColors(e.color, dark, past)
                  const dot = accountDotColor(accountColor(e), dark)
                  return (
                    <button
                      key={e.key}
                      className={`event ${selectedKey === e.key ? 'selected' : ''} ${past ? 'past' : ''} ${compact ? 'compact' : ''}`}
                      style={
                        {
                          top,
                          height: height - 2,
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          '--c': e.color,
                          '--ev-bg': colors.bg,
                          '--ev-hover-bg': colors.hoverBg,
                          '--ev-fg': colors.fg,
                          '--ev-muted': colors.muted,
                          '--ev-border': colors.border,
                          '--dot': dot
                        } as CSSProperties
                      }
                      onClick={() => onSelect(e)}
                    >
                      <span className="event-title">
                        <AccountDot name={accountFullName(accountOf(e), e.accountEmail)} />
                        {e.title}
                      </span>
                      {compact ? (
                        e.meetingLink && <MeetIcon />
                      ) : (
                        <span className="event-time">
                          {fmtTime(eventStart(e))}
                          {e.meetingLink && <MeetIcon />}
                        </span>
                      )}
                    </button>
                  )
                })}
                {isToday && (
                  <div className="now-line" style={{ top: ((now.getTime() - d.getTime()) / 3_600_000) * HOUR_PX }} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
