import type { JSX } from 'react'
import { ArrowRightIcon, PlusIcon } from '@phosphor-icons/react'
import type { Account, CalendarInfo } from '@shared/types'
import { accountDotColor, useDarkMode } from '../../color'

export interface AccountsProps {
  accounts: Account[]
  calendars: CalendarInfo[]
  adding: boolean
  accountError: string | null
  onAddAccount(): void
  onRemoveAccount(email: string): void
}

export function AccountsSection(p: AccountsProps & { onOpenPrivacy(): void }): JSX.Element {
  const dark = useDarkMode()
  return (
    <>
      <h2>Manage accounts</h2>

      <section className="setting-group">
        {p.accounts.length === 0 && (
          <div className="setting muted">No accounts yet. Add your first Google account to see its calendars.</div>
        )}
        {p.accounts.map((a) => {
          const cals = p.calendars.filter((c) => c.accountEmail === a.email)
          const shown = cals.filter((c) => c.enabled).length
          return (
            <div key={a.email} className="setting account-item">
              <span className="dot" style={{ background: accountDotColor(a.color, dark) }} />
              <div className="account-info">
                <div className="email" title={a.email}>
                  {a.email}
                </div>
                <div className="muted small">
                  {shown} of {cals.length} {cals.length === 1 ? 'calendar' : 'calendars'} shown
                </div>
              </div>
              <button
                className="danger"
                onClick={() => confirm(`Remove ${a.email} from All My Calendars?`) && p.onRemoveAccount(a.email)}
              >
                Remove
              </button>
            </div>
          )
        })}
        <div className="setting">
          <button className="join add-btn btn-icon" onClick={p.onAddAccount} disabled={p.adding}>
            {!p.adding && <PlusIcon size={16} weight="bold" aria-hidden />}
            {p.adding ? 'Waiting for browser sign-in…' : 'Add Google account'}
          </button>
        </div>
        {p.accountError && <div className="inline-error">{p.accountError}</div>}
      </section>

      <p className="muted small reassurance">
        You sign in on Google’s own page, and the app only gets read-only access to your calendars. Removing an
        account deletes its sign-in key from this computer.{' '}
        <button className="text-link" onClick={p.onOpenPrivacy}>
          How we protect your privacy <ArrowRightIcon size={14} aria-hidden />
        </button>
      </p>
    </>
  )
}
