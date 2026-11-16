import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowSquareOutIcon, InstagramLogoIcon, LinkedinLogoIcon, type Icon } from '@phosphor-icons/react'
import appIcon from '../../../../../resources/icon.png'

const LINKS: { label: string; handle: string; url: string; icon: Icon }[] = [
  { label: 'Instagram', handle: '@ux.carlos', url: 'https://www.instagram.com/ux.carlos', icon: InstagramLogoIcon },
  { label: 'LinkedIn', handle: 'in/uxcarlos', url: 'https://www.linkedin.com/in/uxcarlos', icon: LinkedinLogoIcon }
]

export function AboutSection(): JSX.Element {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api.getAppInfo().then((i) => setVersion(i.version))
  }, [])

  return (
    <>
      <div className="about-hero">
        <img src={appIcon} alt="" width={96} height={96} />
        <h2>All My Calendars</h2>
        <div className="muted">Version {version}</div>
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
