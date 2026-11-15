/** Error message when the user cancels a sign-in that is waiting for the browser */
export const SIGN_IN_CANCELLED = 'Sign-in cancelled'

export interface Account {
  email: string
  color: string
  /** Optional name shown instead of the email, e.g. "Work" */
  label?: string
}

export interface AccountChanges {
  label?: string
  color?: string
}

export interface CalendarInfo {
  id: string
  accountEmail: string
  name: string
  color: string
  enabled: boolean
  primary: boolean
}

export interface Attendee {
  email: string
  name?: string
  responseStatus?: string
  self?: boolean
}

export interface CalendarEvent {
  /** Unique within the app: accountEmail + calendarId + event id */
  key: string
  iCalUID?: string
  title: string
  start: string // ISO date-time, or YYYY-MM-DD for all-day
  end: string
  allDay: boolean
  location?: string
  description?: string
  meetingLink?: string
  htmlLink?: string
  attendees: Attendee[]
  organizer?: string
  color: string
  calendarName: string
  accountEmail: string
  /** Other accounts/calendars where the same meeting also appears */
  alsoIn: string[]
}

export interface EventsResult {
  events: CalendarEvent[]
  errors: { accountEmail: string; message: string }[]
  fetchedAt: string
  fromCache: boolean
  /** Every account failed (no connection): showing saved events, if any */
  offline?: boolean
}

/** A Chrome profile on this computer, for joining meetings with the right Google account */
export interface ChromeProfile {
  /** Chrome's folder name, e.g. "Default" or "Profile 4" */
  dir: string
  name: string
  /** The Google account signed in to this profile */
  email?: string
  /** Profile picture as a small data URL */
  avatar?: string
}

export interface Settings {
  notifications: boolean
  /** Minutes before a meeting to notify, largest first; 0 means when it starts */
  reminders: number[]
  openAtLogin: boolean
  /** Accounts collapsed in the sidebar */
  collapsedAccounts: string[]
  theme: 'system' | 'light' | 'dark'
  /** Closing the window hides the app to the tray instead of quitting */
  keepInTray: boolean
}

export interface AppInfo {
  version: string
  dataPath: string
}

export interface Api {
  getAccounts(): Promise<Account[]>
  updateAccount(email: string, changes: AccountChanges): Promise<Account[]>
  /** Saves the order accounts appear in (sidebar and Settings) */
  reorderAccounts(emails: string[]): Promise<Account[]>
  /** Stop waiting for a browser sign-in (e.g. the Google tab was closed) */
  cancelSignIn(): Promise<void>
  /** Open the waiting sign-in's Google page again */
  reopenSignIn(): Promise<void>
  addAccount(): Promise<Account>
  removeAccount(email: string): Promise<void>
  getCalendars(): Promise<CalendarInfo[]>
  refreshCalendars(): Promise<CalendarInfo[]>
  setCalendarEnabled(accountEmail: string, calendarId: string, enabled: boolean): Promise<void>
  getEvents(weekStartIso: string, force?: boolean): Promise<EventsResult>
  openExternal(url: string): Promise<void>
  /** Chrome's profiles on this computer ([] when Chrome isn't installed) */
  getChromeProfiles(): Promise<ChromeProfile[]>
  /** Open a link in a specific Chrome profile; false if it couldn't */
  openInChromeProfile(url: string, dir: string): Promise<boolean>
  isConfigured(): Promise<boolean>
  onRefresh(cb: () => void): () => void
  getSettings(): Promise<Settings>
  setSettings(changes: Partial<Settings>): Promise<Settings>
  testNotification(): Promise<void>
  /** Sync with Google right away (e.g. the connection just came back) */
  syncNow(): Promise<void>
  getAppInfo(): Promise<AppInfo>
  openDataFolder(): Promise<void>
  clearCache(): Promise<void>
  /** Main asks the window to open a meeting (e.g. a notification was clicked) */
  onSelectEvent(cb: (key: string, start: string) => void): () => void
}
