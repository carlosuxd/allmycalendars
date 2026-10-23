import { useState } from 'react'
import type { JSX } from 'react'
import { BellRingingIcon, CheckIcon } from '@phosphor-icons/react'
import type { SectionProps } from './SettingsView'

const LEAD_OPTIONS = [1, 5, 10, 15, 30]

export function NotificationsSection({ settings, change }: SectionProps): JSX.Element {
  const [tested, setTested] = useState(false)

  const test = async (): Promise<void> => {
    await window.api.testNotification()
    setTested(true)
    setTimeout(() => setTested(false), 2000)
  }

  return (
    <>
      <h2>Notifications</h2>

      <section className="setting-group">
        <label className="setting">
          <div>
            <div className="setting-label">Notify me before meetings</div>
            <div className="muted small">Click a notification to open that meeting's details and join link.</div>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={settings.notifications}
            onChange={(e) => void change({ notifications: e.target.checked })}
          />
        </label>
        <label className={`setting ${settings.notifications ? '' : 'disabled'}`}>
          <div className="setting-label">When</div>
          <select
            value={settings.leadMinutes}
            disabled={!settings.notifications}
            onChange={(e) => void change({ leadMinutes: Number(e.target.value) })}
          >
            {LEAD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? 'minute' : 'minutes'} before
              </option>
            ))}
          </select>
        </label>
        <div className="setting">
          <div>
            <div className="setting-label">Test</div>
            <div className="muted small">Check that notifications reach you.</div>
          </div>
          <button className="btn-icon" onClick={() => void test()}>
            {tested ? <CheckIcon size={16} weight="bold" aria-hidden /> : <BellRingingIcon size={16} aria-hidden />}
            {tested ? 'Sent' : 'Send test notification'}
          </button>
        </div>
      </section>

      <section className="setting-group notes">
        <div className="setting-label">Good to know</div>
        <ul>
          <li>All-day events, meetings you've declined and calendars you've hidden don't notify.</li>
          <li>
            Reminders need the app running. With "Keep running in the tray" on (in General), closing the window
            doesn't stop them.
          </li>
          <li>
            Not seeing them? On Windows, check that Do not disturb is off and All My Calendars is allowed in Settings →
            System → Notifications. On macOS, allow it in System Settings → Notifications.
          </li>
        </ul>
      </section>
    </>
  )
}
