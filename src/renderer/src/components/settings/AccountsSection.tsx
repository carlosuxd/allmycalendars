import { useEffect, useRef, useState } from 'react'
import type { DragEvent, JSX } from 'react'
import { ArrowRightIcon, CheckIcon, DotsSixVerticalIcon, PlusIcon } from '@phosphor-icons/react'
import type { Account, AccountChanges, CalendarInfo } from '@shared/types'
import { moveItem } from '@shared/reorder'
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
  /** New order for the accounts (emails, top to bottom) */
  onReorderAccounts(emails: string[]): Promise<void>
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
  /** Row whose handle is pressed; only that row is draggable, so text fields keep working */
  const [armed, setArmed] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ email: string; pos: 'before' | 'after' } | null>(null)
  /** Read out by screen readers after a move */
  const [announce, setAnnounce] = useState('')
  const handles = useRef(new Map<string, HTMLButtonElement>())
  const canReorder = p.accounts.length > 1

  const emails = p.accounts.map((a) => a.email)
  const nameOf = (email: string): string => accountName(p.accounts.find((a) => a.email === email), email)

  const move = (from: number, to: number, keyboard = false): void => {
    if (from === to || to < 0 || to >= emails.length) return
    const email = emails[from]
    void p.onReorderAccounts(moveItem(emails, from, to))
    setAnnounce(`${nameOf(email)} moved to position ${to + 1} of ${emails.length}`)
    // Keep keyboard focus on the handle that was moved
    if (keyboard) requestAnimationFrame(() => handles.current.get(email)?.focus())
  }

  const endDrag = (): void => {
    setArmed(null)
    setDragging(null)
    setDrop(null)
  }

  const onDragOver = (e: DragEvent, email: string): void => {
    if (!dragging) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const box = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < box.top + box.height / 2 ? 'before' : 'after'
    if (drop?.email !== email || drop.pos !== pos) setDrop({ email, pos })
  }

  const onDrop = (e: DragEvent): void => {
    e.preventDefault()
    if (dragging && drop) {
      const from = emails.indexOf(dragging)
      let to = emails.indexOf(drop.email) + (drop.pos === 'after' ? 1 : 0)
      if (from < to) to-- // removing the row first shifts the ones below it up
      move(from, to)
    }
    endDrag()
  }

  return (
    <>
      <h2>Manage accounts</h2>

      <section className="setting-group">
        {p.accounts.length === 0 && (
          <div className="setting muted">No accounts yet. Add your first Google account to see its calendars.</div>
        )}
        {canReorder && <p className="muted small reorder-hint">Drag the handles to change the order in the sidebar.</p>}
        {p.accounts.map((a, i) => {
          const cals = p.calendars.filter((c) => c.accountEmail === a.email)
          const shown = cals.filter((c) => c.enabled).length
          const dropClass = drop?.email === a.email && dragging !== a.email ? `drop-${drop.pos}` : ''
          return (
            <div
              key={a.email}
              className={`setting account-item ${dragging === a.email ? 'dragging' : ''} ${dropClass}`}
              draggable={armed === a.email}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', a.email)
                setDragging(a.email)
              }}
              onDragOver={(e) => onDragOver(e, a.email)}
              onDrop={onDrop}
              onDragEnd={endDrag}
            >
              {canReorder && (
                <button
                  ref={(el) => {
                    if (el) handles.current.set(a.email, el)
                    else handles.current.delete(a.email)
                  }}
                  className="drag-handle"
                  aria-label={`Reorder ${accountName(a, a.email)}. Use the up and down arrow keys.`}
                  title="Drag to reorder"
                  onPointerDown={() => setArmed(a.email)}
                  onPointerUp={() => !dragging && setArmed(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault()
                      move(i, i + (e.key === 'ArrowUp' ? -1 : 1), true)
                    }
                  }}
                >
                  <DotsSixVerticalIcon size={18} weight="bold" aria-hidden />
                </button>
              )}
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
        <div className="visually-hidden" role="status" aria-live="polite">
          {announce}
        </div>
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
