import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { ArrowSquareOutIcon, CheckIcon, CopyIcon, XIcon } from '@phosphor-icons/react'
import type { Account, CalendarEvent } from '@shared/types'
import { accountFullName, accountName } from '../accounts'
import { fmtRange } from '../dates'
import { accountDotColor, useDarkMode } from '../color'
import { JoinButton } from './JoinButton'

const RESPONSE: Record<string, string> = {
  accepted: 'Going',
  declined: 'Declined',
  tentative: 'Maybe',
  needsAction: 'Awaiting'
}

function meetingService(url: string): string {
  if (url.includes('meet.google.com')) return 'Google Meet'
  if (url.includes('zoom.us')) return 'Zoom'
  if (url.includes('teams.')) return 'Microsoft Teams'
  if (url.includes('webex.com')) return 'Webex'
  return 'meeting'
}

/** Renders text with URLs turned into links that open in the browser. */
function Linkified({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} onClick={(ev) => (ev.preventDefault(), window.api.openExternal(p))}>
            {p}
          </a>
        ) : (
          p
        )
      )}
    </>
  )
}

/** The meeting link as text, with a copy-to-clipboard button beside it. */
function MeetingLink({ url }: { url: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [url])
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  return (
    <div className="meeting-link">
      <a href={url} title={url} onClick={(ev) => (ev.preventDefault(), window.api.openExternal(url))}>
        {url.replace(/^https?:\/\//, '')}
      </a>
      <button
        className={`copy-btn ${copied ? 'copied' : ''}`}
        onClick={() => void copy()}
        aria-label="Copy meeting link"
        title="Copy link"
      >
        {copied ? (
          <>
            <CheckIcon size={14} weight="bold" aria-hidden /> Copied
          </>
        ) : (
          <CopyIcon size={16} aria-hidden />
        )}
      </button>
    </div>
  )
}

const POPOVER_WIDTH = 360
/** Space between the card and the popover, and the popover and the window edge */
const GAP = 8
const EDGE = 8

type Side = 'right' | 'left' | 'below' | 'above'

/** The calendar card (event or all-day chip) a meeting's popover belongs to. */
function cardFor(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-event-key="${CSS.escape(key)}"]`)
}

/** Where the popover goes: beside the card when it fits, else below or above it. */
function place(card: DOMRect | null, w: number, h: number): { side: Side; left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampTop = (t: number): number => Math.max(EDGE, Math.min(t, vh - h - EDGE))
  const clampLeft = (l: number): number => Math.max(EDGE, Math.min(l, vw - w - EDGE))
  if (!card) return { side: 'below', left: clampLeft((vw - w) / 2), top: clampTop((vh - h) / 2) }
  if (card.right + GAP + w <= vw - EDGE) return { side: 'right', left: card.right + GAP, top: clampTop(card.top) }
  if (card.left - GAP - w >= EDGE) return { side: 'left', left: card.left - GAP - w, top: clampTop(card.top) }
  if (card.bottom + GAP + h <= vh - EDGE || card.top - GAP - h < EDGE) {
    return { side: 'below', left: clampLeft(card.left), top: clampTop(card.bottom + GAP) }
  }
  return { side: 'above', left: clampLeft(card.left), top: clampTop(card.top - GAP - h) }
}

interface Props {
  event: CalendarEvent
  /** The event's account (for its dot color and label) */
  account?: Account
  onClose(): void
}

/** Meeting details in a card that pops up from the meeting's card in the calendar. */
export function EventDetails({ event: e, account, onClose }: Props): JSX.Element {
  const dark = useDarkMode()
  const open = (url: string) => () => void window.api.openExternal(url)
  const popover = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<{ side: Side; left: number; top: number } | null>(null)
  const titleId = `details-title-${useId()}`

  // Follow the card: on open, when switching meetings, scrolling the calendar and resizing
  useLayoutEffect(() => {
    const el = popover.current
    if (!el) return
    cardFor(e.key)?.scrollIntoView({ block: 'nearest' })
    let frame = 0
    const update = (): void => {
      const card = cardFor(e.key)
      setPos(place(card?.getBoundingClientRect() ?? null, el.offsetWidth, el.offsetHeight))
    }
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', schedule, true)
    }
  }, [e.key])

  // Clicking outside closes it; clicking another meeting switches to it instead
  useEffect(() => {
    const onDown = (ev: MouseEvent): void => {
      const target = ev.target as Element
      if (popover.current?.contains(target) || target.closest?.('[data-event-key]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Focus moves into the popover, and back to the meeting's card when it closes
  useEffect(() => {
    popover.current?.focus({ preventScroll: true })
  }, [e.key])
  useEffect(() => {
    const key = e.key
    return () => {
      const active = document.activeElement
      if (!active || active === document.body || popover.current?.contains(active)) {
        cardFor(key)?.focus({ preventScroll: true })
      }
    }
  }, [e.key])

  return (
    <>
    {/* Blurs everything behind the popover except the meeting's own card; a click on it closes */}
    <div className="popover-backdrop" aria-hidden />
    <section
      ref={popover}
      className="details event-popover"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-side={pos?.side}
      style={{
        width: `min(${POPOVER_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
        maxHeight: `calc(100vh - ${EDGE * 2}px)`,
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden'
      }}
    >
      <div className="details-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close">
          <XIcon aria-hidden />
        </button>
      </div>
      <div className="details-title">
        <span
          className="account-dot details-dot"
          style={{ background: accountDotColor(account?.color ?? e.color, dark) }}
          role="img"
          aria-label={`Account: ${accountFullName(account, e.accountEmail)}`}
          title={accountFullName(account, e.accountEmail)}
        />
        <h2 id={titleId}>{e.title}</h2>
      </div>
      <p className="muted">{fmtRange(e)}</p>

      {e.meetingLink && (
        <>
          <JoinButton url={e.meetingLink} accountEmail={e.accountEmail} label={`Join ${meetingService(e.meetingLink)}`} />
          <MeetingLink url={e.meetingLink} />
        </>
      )}

      <dl>
        <dt>Calendar</dt>
        <dd>
          {account?.label ? `${e.calendarName} · ${accountName(account, e.accountEmail)}` : e.calendarName}
          <div className="muted small">{e.accountEmail}</div>
          {e.alsoIn.length > 0 && <div className="muted small">Also in {e.alsoIn.join(', ')}</div>}
        </dd>
        {e.location && (
          <>
            <dt>Location</dt>
            <dd>
              <Linkified text={e.location} />
            </dd>
          </>
        )}
        {e.organizer && (
          <>
            <dt>Organizer</dt>
            <dd>{e.organizer}</dd>
          </>
        )}
        {e.attendees.length > 0 && (
          <>
            <dt>Guests ({e.attendees.length})</dt>
            <dd>
              <ul className="guests">
                {e.attendees.map((a) => (
                  <li key={a.email}>
                    <span>{a.name ?? a.email}</span>
                    <span className={`rsvp ${a.responseStatus ?? ''}`}>{RESPONSE[a.responseStatus ?? ''] ?? ''}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {e.description && (
          <>
            <dt>Description</dt>
            <dd className="description">
              <Linkified text={e.description} />
            </dd>
          </>
        )}
      </dl>

      {e.htmlLink && (
        <button className="link-btn" onClick={open(e.htmlLink)}>
          Open in Google Calendar <ArrowSquareOutIcon size={14} aria-hidden />
        </button>
      )}
    </section>
    </>
  )
}
