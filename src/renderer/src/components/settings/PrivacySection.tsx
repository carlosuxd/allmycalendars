import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import {
  ArrowSquareOutIcon,
  ArrowsLeftRightIcon,
  CheckIcon,
  EyeIcon,
  FolderOpenIcon,
  KeyIcon,
  LaptopIcon,
  ProhibitIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  type Icon
} from '@phosphor-icons/react'

// Every statement here must stay true to the code: scopes in main/auth.ts,
// storage in main/store.ts, and network calls only to Google's APIs.
const PROMISES: { icon: Icon; title: string; body: string }[] = [
  {
    icon: KeyIcon,
    title: 'You sign in on Google’s own page',
    body:
      'Adding an account opens accounts.google.com in your normal web browser. You type your password there, to Google. ' +
      'All My Calendars never sees, receives or stores your password.'
  },
  {
    icon: EyeIcon,
    title: 'Read-only, calendars only',
    body:
      'The app asks Google for permission to view your calendars and to know your account’s email address, so it can ' +
      'label each account. That’s all. It cannot create, change or delete events, and it cannot read your Gmail, ' +
      'contacts, Drive or anything else.'
  },
  {
    icon: ArrowsLeftRightIcon,
    title: 'Straight from Google to this computer',
    body:
      'There is no All My Calendars server. Your events travel directly from Google to this app over an encrypted ' +
      'connection, so they never pass through anyone else, including the people who made the app. The only places ' +
      'the app connects to are Google’s sign-in and Calendar services.'
  },
  {
    icon: LaptopIcon,
    title: 'Kept on this computer only',
    body:
      'Your sign-in keys are encrypted by your operating system (Windows DPAPI or the macOS Keychain). Recently ' +
      'loaded events are saved in your private app-data folder, so the app opens instantly and works offline. ' +
      'Nothing is uploaded or synced anywhere.'
  },
  {
    icon: ProhibitIcon,
    title: 'No tracking, no ads',
    body:
      'No analytics, no telemetry, no advertising, and nothing about you is ever sold or shared. The app’s Google ' +
      'project only identifies the app to Google; it gives no one access to your calendars.'
  },
  {
    icon: SlidersHorizontalIcon,
    title: 'You’re in control',
    body:
      'Remove an account at any time from the sidebar and its key is deleted from this computer. You can also revoke ' +
      'the app’s access from your Google account, and it stops working for that account immediately.'
  }
]

const STEPS = [
  'You click “Add Google account” and sign in on Google’s page in your browser.',
  'Google gives this computer a read-only key for your calendars. The app encrypts and stores it locally.',
  'Every few minutes, the app uses that key to ask Google for this week’s and next week’s events.',
  'Your events are shown here and cached on this computer only. Nothing leaves your device except requests to Google.'
]

export function PrivacySection(): JSX.Element {
  const [cleared, setCleared] = useState(false)
  const [dataPath, setDataPath] = useState('')

  useEffect(() => {
    void window.api.getAppInfo().then((i) => setDataPath(i.dataPath))
  }, [])

  const clear = async (): Promise<void> => {
    await window.api.clearCache()
    setCleared(true)
    setTimeout(() => setCleared(false), 2500)
  }

  return (
    <>
      <div className="privacy-hero">
        <div className="privacy-badge">Our value</div>
        <h2>User privacy first</h2>
        <p>
          We built All My Calendars on one value: <strong>user privacy first</strong>. Your calendars are yours, and
          they stay between you and Google. No one else, not even us, can see the meetings, people or links this app
          shows you.
        </p>
      </div>

      <div className="privacy-cards">
        {PROMISES.map((p) => (
          <article key={p.title} className="privacy-card">
            <div className="privacy-icon" aria-hidden>
              <p.icon size={20} />
            </div>
            <div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="setting-group">
        <div className="setting-label">How it works</div>
        <ol className="how-steps">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="setting-group">
        <div className="setting-label">Your data, your controls</div>
        <div className="setting">
          <div>
            <div>Show my data folder</div>
            <div className="muted small path">{dataPath}</div>
          </div>
          <button className="btn-icon" onClick={() => void window.api.openDataFolder()}>
            <FolderOpenIcon size={16} aria-hidden /> Open folder
          </button>
        </div>
        <div className="setting">
          <div>
            <div>Clear cached events</div>
            <div className="muted small">Deletes saved events from this computer. They reload from Google.</div>
          </div>
          <button className="btn-icon" onClick={() => void clear()}>
            {cleared ? <CheckIcon size={16} weight="bold" aria-hidden /> : <TrashIcon size={16} aria-hidden />}
            {cleared ? 'Cleared' : 'Clear cache'}
          </button>
        </div>
        <div className="setting">
          <div>
            <div>Review Google permissions</div>
            <div className="muted small">See or revoke this app’s access in your Google account.</div>
          </div>
          <button
            className="btn-icon"
            onClick={() => void window.api.openExternal('https://myaccount.google.com/permissions')}
          >
            Open <ArrowSquareOutIcon size={16} aria-hidden />
          </button>
        </div>
      </section>
    </>
  )
}
