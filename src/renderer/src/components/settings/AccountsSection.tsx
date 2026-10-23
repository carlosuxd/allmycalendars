import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowRightIcon, CheckIcon, PlusIcon } from '@phosphor-icons/react'
import type { Account, AccountChanges, CalendarInfo } from '@shared/types'
import { accountName } from '../../accounts'
import { AccountColorPicker } from './AccountColorPicker'
import { SignInWaiting } from '../SignInWaiting'

const LABEL_MAX = 30

export interface AccountsProps {
  accounts: Account[]
  calendars: CalendarInfo[]
  adding: boolean
  accountError: string | null
  onAddAccount(): void
  onRemoveAccount(email: string): void
  onUpdateAccount(email: string, changes: AccountChanges): Promise<void>
  /** While waiting for the browser sign-in */
  onCancelAdd(): void
  onReopenSignIn(): void
}

/** Editable label: saves on Enter or when leaving the field, Esc undoes the edit. */
function AccountLabelField({ account, onSave }: { account: Account; onSave(label: string): Promise<void> }): JSX.Element {
  const saved = account.label ?? ''
  const [value, setValue] = useState(saved)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => setValue(saved), [saved])
  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 1500)
    return () => clearTimeout(t)
  }, [justSaved])

  const commit = async (): Promise<void> => {
    const next = value.trim()
    setValue(next)
    if (next === saved) return
    await onSave(next)
    setJustSaved(true)
  }

  const id = `label-${account.email}`
  return (
    <div className="label-field">
      <label htmlFor={id} className="visually-hidden">
        Label for {account.email}
      </label>
      <input
        id={id}
        className="label-input"
        type="text"
        value={value}
        maxLength={LABEL_MAX}
        placeholder="Add a label, e.g. Work"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            // Undo the edit without closing Settings
            e.stopPropagation()
            setValue(saved)
            requestAnimationFrame(() => e.currentTarget?.blur())
          }
        }}
      />
      {justSaved && (
        <span className="saved-note" role="status">
          <CheckIcon size={14} weight="bold" aria-hidden /> Saved
        </span>
      )}
    </div>
  )
}

export function AccountsSection(p: AccountsProps & { onOpenPrivacy(): void }): JSX.Element {
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
              <AccountColorPicker
                color={a.color}
                name={accountName(a, a.email)}
                onChange={(color) => void p.onUpdateAccount(a.email, { color })}
              />
              <div className="account-info">
                <div className="email" title={a.email}>
                  {a.email}
                </div>
                <div className="muted small">
                  {shown} of {cals.length} {cals.length === 1 ? 'calendar' : 'calendars'} shown
                </div>
                <AccountLabelField account={a} onSave={(label) => p.onUpdateAccount(a.email, { label })} />
              </div>
              <button
                className="danger"
                onClick={() =>
                  confirm(`Remove ${accountName(a, a.email)} from All My Calendars?`) && p.onRemoveAccount(a.email)
                }
              >
                Remove
              </button>
            </div>
          )
        })}
        <div className="setting">
          {p.adding ? (
            <SignInWaiting onReopen={p.onReopenSignIn} onCancel={p.onCancelAdd} />
          ) : (
            <button className="join add-btn btn-icon" onClick={p.onAddAccount}>
              <PlusIcon size={16} weight="bold" aria-hidden />
              Add Google account
            </button>
          )}
        </div>
        {p.accountError && <div className="inline-error">{p.accountError}</div>}
      </section>

      <p className="muted small reassurance">
        Labels and colors are only stored on this computer. You sign in on Google’s own page, and the app only gets
        read-only access to your calendars. Removing an account deletes its sign-in key from this computer.{' '}
        <button className="text-link" onClick={p.onOpenPrivacy}>
          How we protect your privacy <ArrowRightIcon size={14} aria-hidden />
        </button>
      </p>
    </>
  )
}
