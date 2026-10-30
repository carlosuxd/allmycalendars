import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, JSX } from 'react'
import { BrowserIcon, CheckCircleIcon } from '@phosphor-icons/react'
import type { ChromeProfile } from '@shared/types'

interface Props {
  url: string
  /** The meeting's account, to pre-select the Chrome profile signed in with it */
  accountEmail: string
  label: string
  className?: string
}

const DEFAULT_BROWSER = '__default'
const PICKER_WIDTH = 320

/**
 * Join button that asks which Chrome profile to open the meeting in, so you join with the right
 * Google account. Without Chrome profiles it simply opens the default browser.
 */
export function JoinButton({ url, accountEmail, label, className = 'join' }: Props): JSX.Element {
  const [profiles, setProfiles] = useState<ChromeProfile[] | null>(null)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<CSSProperties>({})
  const trigger = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])

  const options = profiles ? [...profiles, { dir: DEFAULT_BROWSER, name: 'Default browser' } as ChromeProfile] : []
  const matches = (p: ChromeProfile): boolean => !!p.email && p.email.toLowerCase() === accountEmail.toLowerCase()

  const open = async (): Promise<void> => {
    const list = await window.api.getChromeProfiles()
    if (!list.length) return void window.api.openExternal(url)
    const match = list.findIndex(matches)
    setActive(match >= 0 ? match : 0)
    setProfiles(list)
  }

  const close = (): void => {
    setProfiles(null)
    trigger.current?.focus()
  }

  const choose = async (p: ChromeProfile): Promise<void> => {
    setProfiles(null)
    const opened = p.dir !== DEFAULT_BROWSER && (await window.api.openInChromeProfile(url, p.dir))
    if (!opened) await window.api.openExternal(url)
  }

  // Fixed position next to the button, so the sidebar or details panel can't clip it
  useLayoutEffect(() => {
    if (!profiles || !trigger.current) return
    const b = trigger.current.getBoundingClientRect()
    const width = Math.min(PICKER_WIDTH, window.innerWidth - 16)
    const left = Math.max(8, Math.min(b.left, window.innerWidth - width - 8))
    const height = picker.current?.offsetHeight ?? 0
    const below = b.bottom + 6 + height <= window.innerHeight - 8
    setPos({ left, width, ...(below ? { top: b.bottom + 6 } : { bottom: window.innerHeight - b.top + 6 }) })
  }, [profiles])

  useEffect(() => {
    if (profiles) items.current[active]?.focus()
  }, [profiles, active])

  useEffect(() => {
    if (!profiles) return
    const onDown = (e: MouseEvent): void => {
      if (!picker.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setProfiles(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [profiles])

  const onKeyDown = (e: ReactKeyboardEvent): void => {
    // Esc closes only the picker, not the details panel or Settings behind it
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : options.length - 1)
    }
  }

  return (
    <>
      <button
        ref={trigger}
        className={className}
        onClick={() => (profiles ? setProfiles(null) : void open())}
        aria-haspopup="menu"
        aria-expanded={!!profiles}
      >
        {label}
      </button>
      {profiles && (
        <div
          ref={picker}
          className="join-picker"
          style={{ position: 'fixed', ...pos }}
          role="menu"
          aria-label="Join with which Chrome profile"
          onKeyDown={onKeyDown}
        >
          <div className="join-picker-title">Join with…</div>
          {options.map((p, i) => {
            const isDefault = p.dir === DEFAULT_BROWSER
            return (
              <button
                key={p.dir}
                ref={(el) => {
                  items.current[i] = el
                }}
                role="menuitem"
                tabIndex={i === active ? 0 : -1}
                className={`profile-option ${i === active ? 'active' : ''} ${isDefault ? 'default-browser' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => void choose(p)}
              >
                <span className="profile-avatar" aria-hidden>
                  {isDefault ? (
                    <BrowserIcon size={18} />
                  ) : p.avatar ? (
                    <img src={p.avatar} alt="" />
                  ) : (
                    p.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="profile-text">
                  <span className="profile-name">{p.name}</span>
                  {p.email && <span className="profile-email">{p.email}</span>}
                </span>
                {matches(p) && (
                  <span className="profile-match" title="Matches this meeting's account">
                    <CheckCircleIcon size={16} weight="fill" aria-hidden />
                    <span className="visually-hidden">Matches this meeting's account</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
