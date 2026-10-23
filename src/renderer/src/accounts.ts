import type { Account } from '@shared/types'

/** The name to show for an account: its label if it has one, otherwise its email. */
export function accountName(account: Account | undefined, email: string): string {
  return account?.label || email
}

/** "Work (me@company.com)" when labeled, otherwise just the email. For tooltips and screen readers. */
export function accountFullName(account: Account | undefined, email: string): string {
  return account?.label ? `${account.label} (${email})` : email
}
