import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowLeftIcon, BellIcon, GearSixIcon, ShieldCheckIcon, UserCircleIcon, type Icon } from '@phosphor-icons/react'
import type { Settings } from '@shared/types'
import { GeneralSection } from './GeneralSection'
import { NotificationsSection } from './NotificationsSection'
import { PrivacySection } from './PrivacySection'
import { AccountsSection, type AccountsProps } from './AccountsSection'

export type SettingsSection = 'general' | 'accounts' | 'notifications' | 'privacy'

export interface SectionProps {
  settings: Settings
  change(changes: Partial<Settings>): Promise<void>
}

const SECTIONS: { id: SettingsSection; label: string; icon: Icon }[] = [
  { id: 'general', label: 'General', icon: GearSixIcon },
  { id: 'accounts', label: 'Manage accounts', icon: UserCircleIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheckIcon }
]

interface Props extends AccountsProps {
  section: SettingsSection
  onSection(s: SettingsSection): void
  onClose(): void
}

export function SettingsView({ section, onSection, onClose, ...accountProps }: Props): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const change = async (changes: Partial<Settings>): Promise<void> => {
    setSettings(await window.api.setSettings(changes))
  }

  return (
    <div className="settings-view" role="dialog" aria-label="Settings">
      <header className="settings-header">
        <button className="btn-icon" onClick={onClose}>
          <ArrowLeftIcon size={16} aria-hidden /> Back to calendar
        </button>
        <h1>Settings</h1>
      </header>
      <div className="settings-body">
        <nav className="settings-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={section === s.id ? 'active' : ''}
              aria-current={section === s.id ? 'page' : undefined}
              onClick={() => onSection(s.id)}
            >
              {/* The current section gets the filled icon */}
              <s.icon className="nav-icon" weight={section === s.id ? 'fill' : 'regular'} aria-hidden />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <div className="settings-inner">
            {section === 'accounts' ? (
              <AccountsSection {...accountProps} onOpenPrivacy={() => onSection('privacy')} />
            ) : section === 'privacy' ? (
              <PrivacySection />
            ) : settings ? (
              section === 'general' ? (
                <GeneralSection settings={settings} change={change} />
              ) : (
                <NotificationsSection settings={settings} change={change} />
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
