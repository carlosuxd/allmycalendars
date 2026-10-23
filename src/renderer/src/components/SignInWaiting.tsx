import type { JSX } from 'react'
import { ArrowClockwiseIcon, ArrowSquareOutIcon } from '@phosphor-icons/react'

interface Props {
  onReopen(): void
  onCancel(): void
}

/**
 * Shown while waiting for the Google sign-in in the browser. The app can't tell if that tab
 * was closed, so you can reopen the page or cancel instead of waiting for the timeout.
 */
export function SignInWaiting({ onReopen, onCancel }: Props): JSX.Element {
  return (
    <div className="signin-waiting" role="status">
      <span className="signin-text">
        <ArrowClockwiseIcon size={16} className="spin" aria-hidden />
        Waiting for you to sign in to Google in your browser…
      </span>
      <span className="signin-actions">
        <button className="text-link" onClick={onReopen}>
          Open sign-in page again <ArrowSquareOutIcon size={14} aria-hidden />
        </button>
        <button onClick={onCancel}>Cancel</button>
      </span>
    </div>
  )
}
