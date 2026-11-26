import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  GearSixIcon,
  LockSimpleIcon,
  SidebarSimpleIcon,
  XIcon
} from '@phosphor-icons/react'
import { SIGN_IN_CANCELLED, type Account, type AccountChanges, type CalendarEvent, type CalendarInfo, type EventsResult } from '@shared/types'
import { addDays, eventEnd, eventStart, fmtRangeTitle, startOfDay, startOfWeek } from './dates'
import { Sidebar } from './components/Sidebar'
import { WeekView } from './components/WeekView'
import { EventDetails } from './components/EventDetails'
import { SignInWaiting } from './components/SignInWaiting'
import { reorderByEmail } from '@shared/reorder'
import { SettingsView, type SettingsSection } from './components/settings/SettingsView'

/** Narrowest a day column may get before a day is dropped */
const MIN_DAY_PX = 130
/** Width of the hours column in the week view */
const GUTTER_PX = 56
/** Below this window width the sidebar becomes a drawer opened from the header */
const SIDEBAR_INLINE_MIN = 900
/** Below this window width the header uses compact labels */
const COMPACT_HEADER_MAX = 700

function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/** Merges the per-week results that cover the visible days. */
function mergeResults(results: EventsResult[]): EventsResult {
  const seen = new Set<string>()
  const events = results.flatMap((r) => r.events).filter((e) => !seen.has(e.key) && seen.add(e.key))
  const errors = results.flatMap((r) => r.errors).filter((e, i, all) => all.findIndex((x) => x.accountEmail === e.accountEmail) === i)
  return {
    events,
    errors,
    fetchedAt: results.map((r) => r.fetchedAt).sort()[0],
    fromCache: results.every((r) => r.fromCache),
    offline: results.some((r) => r.offline)
  }
}

export function App(): JSX.Element {
  const [configured, setConfigured] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  /** First visible day; with a full week on screen, the week containing it is shown */
  const [rangeStart, setRangeStart] = useState(() => startOfDay(new Date()))
  /** How many days fit, measured from the calendar area */
  const [dayCount, setDayCount] = useState(7)
  const [result, setResult] = useState<EventsResult | null>(null)
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([])
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  /** A meeting to open once its days have loaded (from a notification or the tray) */
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Remembered while the app runs, so the Settings button reopens the last section */
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const openSettings = (section?: SettingsSection): void => {
    if (section) setSettingsSection(section)
    setSidebarOpen(false)
    setSettingsOpen(true)
  }
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  /** Which range `result` holds */
  const [resultRange, setResultRange] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const windowWidth = useWindowWidth()
  const narrow = windowWidth < SIDEBAR_INLINE_MIN
  const compactHeader = windowWidth < COMPACT_HEADER_MAX

  // Close the drawer once the sidebar fits inline again
  useEffect(() => {
    if (!narrow) setSidebarOpen(false)
  }, [narrow])

  // Measure how many day columns fit
  const weekArea = useRef<HTMLDivElement>(null)
  const hasAccounts = accounts.length > 0
  useEffect(() => {
    const el = weekArea.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width - GUTTER_PX) / MIN_DAY_PX)
      setDayCount(Math.min(7, Math.max(2, fit)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasAccounts])

  const days = useMemo(() => {
    const first = dayCount === 7 ? startOfWeek(rangeStart) : rangeStart
    return Array.from({ length: dayCount }, (_, i) => addDays(first, i))
  }, [rangeStart, dayCount])
  const rangeKey = `${days[0].toISOString()}|${days.length}`

  const loadAccounts = useCallback(async () => {
    setAccounts(await window.api.getAccounts())
    setCalendars(await window.api.getCalendars())
  }, [])

  const loadEvents = useCallback(
    async (force = false) => {
      if (!(await window.api.getAccounts()).length) return setResult(null)
      setLoading(true)
      try {
        // The visible days can span two weeks; the cache is per week
        const weeks = [...new Set([days[0], days[days.length - 1]].map((d) => startOfWeek(d).toISOString()))]
        const results = await Promise.all(weeks.map((w) => window.api.getEvents(w, force)))
        setResult(mergeResults(results))
        setResultRange(rangeKey)
        setCalendars(await window.api.getCalendars())
        // "Next meeting" always looks at this week and next, whatever is on screen
        const thisWeek = startOfWeek(new Date())
        const [a, b] = await Promise.all([
          window.api.getEvents(thisWeek.toISOString(), force),
          window.api.getEvents(addDays(thisWeek, 7).toISOString(), force)
        ])
        setUpcoming([...a.events, ...b.events])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    // rangeKey captures `days`
    [rangeKey]
  )

  useEffect(() => {
    void window.api.isConfigured().then(setConfigured)
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents, accounts])

  // Main just synced; read the fresh cache
  useEffect(() => window.api.onRefresh(() => void loadEvents()), [loadEvents])

  // The connection came back: sync right away instead of waiting for the next retry
  useEffect(() => {
    const onOnline = (): void => void window.api.syncNow()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(
    () =>
      window.api.onSelectEvent((key, start) => {
        setSelected(null)
        setSettingsOpen(false)
        setSidebarOpen(false)
        setPendingKey(key)
        setRangeStart(startOfDay(new Date(start)))
      }),
    []
  )

  useEffect(() => {
    if (!pendingKey || !result || resultRange !== rangeKey) return
    // If it's missing, the meeting was deleted or its calendar hidden
    setSelected(result.events.find((e) => e.key === pendingKey) ?? null)
    setPendingKey(null)
  }, [pendingKey, result, resultRange, rangeKey])

  // Esc closes the drawer, then the details panel (Settings handles its own Esc)
  useEffect(() => {
    if (settingsOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (sidebarOpen) setSidebarOpen(false)
      else setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settingsOpen, sidebarOpen])


  const nextEvent = useMemo(() => {
    const now = new Date()
    return upcoming
      .filter((e) => !e.allDay && eventEnd(e) > now)
      .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0]
  }, [upcoming])

  const addAccount = async (): Promise<void> => {
    setAdding(true)
    setError(null)
    try {
      await window.api.addAccount()
      await loadAccounts()
    } catch (err) {
      const message = String((err as Error).message).replace(/^Error invoking remote method '\w+': (Error: )?/, '')
      // Cancelling is the user's choice, not an error
      if (message !== SIGN_IN_CANCELLED) setError(message)
    } finally {
      setAdding(false)
    }
  }

  /** Stop waiting for the browser; the pending addAccount() then finishes and resets the button */
  const cancelAdd = (): void => void window.api.cancelSignIn()
  const reopenSignIn = (): void => void window.api.reopenSignIn()

  /** Label or dot color changed in Settings; the sidebar and calendar update right away */
  const updateAccount = async (email: string, changes: AccountChanges): Promise<void> => {
    setAccounts(await window.api.updateAccount(email, changes))
  }

  /** New account order from Settings: show it at once, then take the saved order */
  const reorderAccounts = async (emails: string[]): Promise<void> => {
    setAccounts((current) => reorderByEmail(current, emails))
    setAccounts(await window.api.reorderAccounts(emails))
  }

  const removeAccount = async (email: string): Promise<void> => {
    await window.api.removeAccount(email)
    setSelected(null)
    await loadAccounts()
  }

  const toggleCalendar = async (c: CalendarInfo): Promise<void> => {
    await window.api.setCalendarEnabled(c.accountEmail, c.id, !c.enabled)
    setCalendars(await window.api.getCalendars())
    await loadEvents(true)
  }

  /** -1 / +1 moves by the number of days on screen (a whole week when it fits); 0 goes to today */
  const go = (direction: number): void => {
    setSelected(null)
    if (direction === 0) setRangeStart(startOfDay(new Date()))
    else if (dayCount === 7) setRangeStart(addDays(startOfWeek(rangeStart), 7 * direction))
    else setRangeStart(addDays(rangeStart, dayCount * direction))
  }

  const selectFromSidebar = (e: CalendarEvent): void => {
    setSidebarOpen(false)
    setPendingKey(e.key)
    setRangeStart(startOfDay(eventStart(e)))
  }

  if (!configured) {
    return (
      <div className="empty">
        <h1>Almost there</h1>
        <p>
          All My Calendars needs a Google OAuth client ID. Copy <code>.env.example</code> to <code>.env</code>, fill in
          the values from Google Cloud Console (see README.md), then restart the app.
        </p>
      </div>
    )
  }

  const sidebar = (
    <Sidebar
      accounts={accounts}
      calendars={calendars}
      nextEvent={nextEvent}
      drawer={narrow}
      onManage={() => openSettings('accounts')}
      onToggle={toggleCalendar}
      onSelect={selectFromSidebar}
      onOpenPrivacy={() => openSettings('privacy')}
    />
  )
  const span = dayCount === 7 ? 'week' : `${dayCount} days`

  return (
    <div className="app">
      {!narrow && sidebar}
      {narrow && sidebarOpen && (
        <>
          <div className="backdrop" onClick={() => setSidebarOpen(false)} />
          {sidebar}
        </>
      )}
      <main className="main">
        <header className="toolbar">
          {narrow && (
            <button
              className="icon-btn sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-expanded={sidebarOpen}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <SidebarSimpleIcon size={20} aria-hidden />
            </button>
          )}
          <button onClick={() => go(0)}>Today</button>
          <button className="icon-btn" onClick={() => go(-1)} aria-label={`Previous ${span}`} title={`Previous ${span}`}>
            <CaretLeftIcon aria-hidden />
          </button>
          <button className="icon-btn" onClick={() => go(1)} aria-label={`Next ${span}`} title={`Next ${span}`}>
            <CaretRightIcon aria-hidden />
          </button>
          <h1 title={fmtRangeTitle(days, false)}>
            <span key={fmtRangeTitle(days, compactHeader)} className="title-swap">
              {fmtRangeTitle(days, compactHeader)}
            </span>
          </h1>
          <div className="spacer" />
          {result?.offline && (
            <span className="badge warn">{compactHeader ? 'Offline' : 'Offline · showing saved'}</span>
          )}
          {compactHeader ? (
            <button
              className="icon-btn refresh-icon"
              onClick={() => void loadEvents(true)}
              disabled={loading}
              aria-label={loading ? 'Refreshing' : 'Refresh'}
              title="Refresh"
            >
              <ArrowClockwiseIcon size={20} className={loading ? 'spin' : ''} aria-hidden />
            </button>
          ) : (
            <button onClick={() => void loadEvents(true)} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          <button className="icon-btn" onClick={() => openSettings()} aria-label="Settings" title="Settings">
            <GearSixIcon size={20} aria-hidden />
          </button>
        </header>

        {error && (
          <div className="banner error">
            {error}
            <button className="icon-btn" onClick={() => setError(null)} aria-label="Dismiss">
              <XIcon size={16} aria-hidden />
            </button>
          </div>
        )}
        {result && !result.offline && result.errors.length > 0 && (
          <div className="banner warn">
            Couldn't load {result.errors.map((e) => e.accountEmail).join(', ')}. If this keeps happening, remove the
            account and add it again.
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="empty">
            <h1>Bring all your calendars together</h1>
            <p>Add each of your Google accounts. You'll sign in through your browser; your password never touches this app.</p>
            {adding ? (
              <SignInWaiting onReopen={reopenSignIn} onCancel={cancelAdd} />
            ) : (
              <button className="join" onClick={addAccount}>
                Add Google account
              </button>
            )}
            <button className="privacy-link" onClick={() => openSettings('privacy')}>
              <LockSimpleIcon size={12} aria-hidden /> How we protect your privacy
            </button>
          </div>
        ) : (
          <div className="content">
            <div className="week-area" ref={weekArea}>
              <WeekView
                days={days}
                events={result?.events ?? []}
                accounts={accounts}
                selectedKey={selected?.key}
                onSelect={setSelected}
              />
            </div>
            {selected && (
              <EventDetails
                event={selected}
                account={accounts.find((a) => a.email === selected.accountEmail)}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        )}
      </main>
      {settingsOpen && (
        <SettingsView
          section={settingsSection}
          onSection={setSettingsSection}
          onClose={closeSettings}
          accounts={accounts}
          calendars={calendars}
          adding={adding}
          accountError={error}
          onAddAccount={addAccount}
          onRemoveAccount={removeAccount}
          onUpdateAccount={updateAccount}
          onReorderAccounts={reorderAccounts}
          onCancelAdd={cancelAdd}
          onReopenSignIn={reopenSignIn}
        />
      )}
    </div>
  )
}
