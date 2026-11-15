import { useState } from 'react'
import type { JSX } from 'react'
import { BellRingingIcon, CheckIcon } from '@phosphor-icons/react'
import type { SectionProps } from './SettingsView'

/** Minutes before a meeting; 0 is when it starts */
const REMINDER_OPTIONS = [60, 30, 15, 10, 5, 1, 0]

const reminderLabel = (m: number): string => (m === 0 ? 'At start' : m === 60 ? '1 hour' : `${m} min`)

export function NotificationsSection({ settings, change }: SectionProps): JSX.Element {
  const [tested, setTested] = useState(false)

  const toggleReminder = (m: number): void => {
    const on = settings.reminders.includes(m)
    // Keep at least one; turning notifications off is the switch above
    if (on && settings.reminders.length === 1) return
    void change({ reminders: on ? settings.reminders.filter((x) => x !== m) : [...settings.reminders, m] })
  }

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
        <div className={`setting stacked ${settings.notifications ? '' : 'disabled'}`}>
          <div>
            <div className="setting-label">When</div>
            <div className="muted small">Pick one or more. Each meeting reminds you at every time you choose.</div>
          </div>
          <div className="segmented multi" role="group" aria-label="Reminder times">
            {REMINDER_OPTIONS.map((m) => {
              const on = settings.reminders.includes(m)
              return (
                <button
                  key={m}
                  aria-pressed={on}
                  className={on ? 'active' : ''}
                  disabled={!settings.notifications}
                  onClick={() => toggleReminder(m)}
                >
                  {reminderLabel(m)}
                </button>
              )
            })}
          </div>
        </div>
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
