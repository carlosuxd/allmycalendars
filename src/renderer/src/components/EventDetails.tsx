import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowSquareOutIcon, CheckIcon, CopyIcon, XIcon } from '@phosphor-icons/react'
import type { CalendarEvent } from '@shared/types'
import { fmtRange } from '../dates'
import { accountDotColor, useDarkMode } from '../color'

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

interface Props {
  event: CalendarEvent
  /** The account's color, as shown in the sidebar */
  accountColor: string
  /** Show over the calendar instead of beside it (narrow windows) */
  overlay?: boolean
  onClose(): void
}

export function EventDetails({ event: e, accountColor, overlay, onClose }: Props): JSX.Element {
  const dark = useDarkMode()
  const open = (url: string) => () => void window.api.openExternal(url)
  return (
    <aside className={overlay ? 'details overlay' : 'details'}>
      <div className="details-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close">
          <XIcon aria-hidden />
        </button>
      </div>
      <div className="details-title">
        <span
          className="account-dot details-dot"
          style={{ background: accountDotColor(accountColor, dark) }}
          role="img"
          aria-label={`Account: ${e.accountEmail}`}
          title={e.accountEmail}
        />
        <h2>{e.title}</h2>
      </div>
      <p className="muted">{fmtRange(e)}</p>

      {e.meetingLink && (
        <>
          <button className="join" onClick={open(e.meetingLink)}>
            Join {meetingService(e.meetingLink)}
          </button>
          <MeetingLink url={e.meetingLink} />
        </>
      )}

      <dl>
        <dt>Calendar</dt>
        <dd>
          {e.calendarName}
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
    </aside>
  )
}
