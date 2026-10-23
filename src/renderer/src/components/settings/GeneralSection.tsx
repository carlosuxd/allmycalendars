import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AppInfo, Settings } from '@shared/types'
import type { SectionProps } from './SettingsView'

const THEMES: { id: Settings['theme']; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

export function GeneralSection({ settings, change }: SectionProps): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.getAppInfo().then(setInfo)
  }, [])

  return (
    <>
      <h2>General</h2>

      <section className="setting-group">
        <div className="setting">
          <div>
            <div className="setting-label">Theme</div>
            <div className="muted small">System follows your Windows or macOS appearance.</div>
          </div>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={settings.theme === t.id}
                className={settings.theme === t.id ? 'active' : ''}
                onClick={() => void change({ theme: t.id })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="setting-group">
        <label className="setting">
          <div>
            <div className="setting-label">Start when I log in</div>
            <div className="muted small">Opens quietly in the tray so reminders start right away. Installed app only.</div>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={settings.openAtLogin}
            onChange={(e) => void change({ openAtLogin: e.target.checked })}
          />
        </label>
        <label className="setting">
          <div>
            <div className="setting-label">Keep running in the tray when I close the window</div>
            <div className="muted small">
              {settings.keepInTray
                ? 'Meeting reminders keep arriving. Use Quit in the tray menu to exit.'
                : 'Closing the window quits the app, and meeting reminders stop.'}
            </div>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={settings.keepInTray}
            onChange={(e) => void change({ keepInTray: e.target.checked })}
          />
        </label>
      </section>

      <section className="setting-group">
        <div className="setting">
          <div>
            <div className="setting-label">About</div>
            <div className="muted small">All My Calendars {info ? info.version : ''}</div>
          </div>
        </div>
      </section>
    </>
  )
}
