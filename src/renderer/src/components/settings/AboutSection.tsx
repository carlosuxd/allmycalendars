import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowSquareOutIcon, InstagramLogoIcon, LinkedinLogoIcon, type Icon } from '@phosphor-icons/react'
import type { UpdateStatus } from '@shared/types'
import appIcon from '../../../../../resources/icon.png'

const LINKS: { label: string; handle: string; url: string; icon: Icon }[] = [
  { label: 'Instagram', handle: '@ux.carlos', url: 'https://www.instagram.com/ux.carlos', icon: InstagramLogoIcon },
  { label: 'LinkedIn', handle: 'in/uxcarlos', url: 'https://www.linkedin.com/in/uxcarlos', icon: LinkedinLogoIcon }
]

function updateMessage(u: UpdateStatus): string {
  switch (u.state) {
    case 'checking':
      return 'Checking for updates…'
    case 'downloading':
      return `Downloading version ${u.version}… ${u.percent ?? 0}%`
    case 'ready':
      return `Version ${u.version} is ready to install.`
    case 'up-to-date':
      return 'You’re up to date.'
    case 'error':
      return `Couldn’t check for updates. ${u.message ?? ''}`.trim()
    default:
      return ''
  }
}

export function AboutSection(): JSX.Element {
  const [version, setVersion] = useState('')
  const [canUpdate, setCanUpdate] = useState(false)
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => {
    void window.api.getAppInfo().then((i) => {
      setVersion(i.version)
      setCanUpdate(i.canUpdate)
    })
    void window.api.getUpdateStatus().then(setUpdate)
    return window.api.onUpdateStatus(setUpdate)
  }, [])

  const busy = update.state === 'checking' || update.state === 'downloading'

  return (
    <>
      <div className="about-hero">
        <img src={appIcon} alt="" width={96} height={96} />
        <h2>All My Calendars</h2>
        <div className="muted">Version {version}</div>
        <div className="update-check">
          {update.state === 'ready' ? (
            <button className="join" onClick={() => void window.api.installUpdate()}>
              Restart now
            </button>
          ) : (
            <button onClick={() => void window.api.checkForUpdates()} disabled={!canUpdate || busy}>
              Check for updates
            </button>
          )}
          <div className="muted small" role="status">
            {canUpdate ? updateMessage(update) : 'Updates work in the installed app.'}
          </div>
        </div>
        <p>All your Google calendars in one weekly view.</p>
      </div>

      <section className="setting-group maker-card">
        <div className="setting-label">About the maker</div>
        <div className="maker-name">Carlos Collazos</div>
        <div className="muted">Senior Product Designer</div>
        <p>
          I designed and built All My Calendars to see every meeting from all my Google accounts in one calm, private
          place, with user privacy first.
        </p>
        <div className="social-links">
          {LINKS.map((l) => (
            <button
              key={l.url}
              className="btn-icon"
              onClick={() => void window.api.openExternal(l.url)}
              aria-label={`Carlos Collazos on ${l.label} (opens in browser)`}
              title={l.url}
            >
              <l.icon size={18} aria-hidden />
              {l.label}
              <span className="muted small">{l.handle}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="about-footer muted small">
        Icons by{' '}
        <button className="text-link" onClick={() => void window.api.openExternal('https://phosphoricons.com')}>
          Phosphor Icons <ArrowSquareOutIcon size={12} aria-hidden />
        </button>{' '}
        (MIT license).
      </p>
    </>
  )
}
