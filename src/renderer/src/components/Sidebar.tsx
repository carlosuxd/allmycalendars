import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { CaretDownIcon, CaretRightIcon, LockSimpleIcon } from '@phosphor-icons/react'
import type { Account, CalendarEvent, CalendarInfo } from '@shared/types'
import { eventEnd, eventStart, fmtTime, sameDay } from '../dates'
import { accountDotColor, ensureContrast, THEME, useDarkMode } from '../color'

interface Props {
  accounts: Account[]
  calendars: CalendarInfo[]
  nextEvent?: CalendarEvent
  onManage(): void
  onToggle(cal: CalendarInfo): void
  onSelect(e: CalendarEvent): void
  onOpenPrivacy(): void
  /** Slide-in drawer over the calendar (narrow windows) */
  drawer?: boolean
}

function NextUp({ event: e, onSelect }: { event: CalendarEvent; onSelect(e: CalendarEvent): void }): JSX.Element {
  const start = eventStart(e)
  const now = new Date()
  const live = start <= now && eventEnd(e) > now
  const mins = Math.round((start.getTime() - now.getTime()) / 60_000)
  const when = live
    ? 'Now'
    : mins < 60
      ? `In ${mins} min`
      : sameDay(start, now)
        ? `Today ${fmtTime(start)}`
        : start.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + fmtTime(start)
  return (
    <div className="next-up" style={{ '--c': e.color } as CSSProperties}>
      <div className="next-label">{live ? 'Happening now' : 'Next meeting'}</div>
      <button className="next-title" onClick={() => onSelect(e)}>
        {e.title}
      </button>
      <div className="muted small">{when}</div>
      {e.meetingLink && (
        <button className="join small-join" onClick={() => window.api.openExternal(e.meetingLink!)}>
          Join
        </button>
      )}
    </div>
  )
}

export function Sidebar(p: Props): JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // Checkbox colors must stand out 3:1 against the sidebar (pale calendar colors don't)
  const dark = useDarkMode()
  const sidebarBg = dark ? THEME.dark.bgSoft : THEME.light.bgSoft

  // Restore which accounts were collapsed last time
  useEffect(() => {
    void window.api.getSettings().then((s) => setCollapsed(new Set(s.collapsedAccounts)))
  }, [])

  const toggle = (email: string): void => {
    const next = new Set(collapsed)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setCollapsed(next)
    void window.api.setSettings({ collapsedAccounts: [...next] })
  }

  return (
    <nav className={p.drawer ? 'sidebar drawer' : 'sidebar'} aria-label="Accounts and calendars">
      <div className="brand">All My Calendars</div>

      {p.nextEvent && <NextUp event={p.nextEvent} onSelect={p.onSelect} />}

      <div className="section-row">
        <div className="section-title">Accounts</div>
        <button className="manage-btn" onClick={p.onManage} title="Add or remove accounts">
          Manage
        </button>
      </div>
      {p.accounts.map((a) => {
        const cals = p.calendars.filter((c) => c.accountEmail === a.email)
        const open = !collapsed.has(a.email)
        return (
          <div key={a.email} className="account">
            <div className="account-row">
              <button className="account-name" onClick={() => toggle(a.email)}>
                <span className="caret" aria-hidden>
                  {open ? <CaretDownIcon size={12} weight="bold" /> : <CaretRightIcon size={12} weight="bold" />}
                </span>
                <span className="dot" style={{ background: accountDotColor(a.color, dark) }} />
                {a.label ? (
                  <span className="account-text" title={a.email}>
                    <span className="label-line">{a.label}</span>
                    <span className="email-line">{a.email}</span>
                  </span>
                ) : (
                  <span className="email" title={a.email}>
                    {a.email}
                  </span>
                )}
              </button>
            </div>
            {open && (
              <ul className="cal-list">
                {cals.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={() => p.onToggle(c)}
                        style={{ accentColor: ensureContrast(c.color, sidebarBg, 3) }}
                      />
                      <span title={c.name}>{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <button className="privacy-link sidebar-bottom" onClick={p.onOpenPrivacy}>
        <LockSimpleIcon size={12} aria-hidden /> How we protect your privacy
      </button>
    </nav>
  )
}
