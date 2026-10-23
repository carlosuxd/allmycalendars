import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Account, CalendarInfo, EventsResult, Settings } from '@shared/types'

interface StoredAccount extends Account {
  /** Refresh token, encrypted with the OS keychain (base64) */
  token: string
}

interface Data {
  accounts: StoredAccount[]
  calendars: CalendarInfo[]
  /** Last fetched events per week, so the app opens instantly / offline */
  cache: Record<string, EventsResult>
  settings?: Settings
}

const DEFAULT_SETTINGS: Settings = {
  notifications: true,
  leadMinutes: 5,
  openAtLogin: false,
  collapsedAccounts: [],
  theme: 'system',
  keepInTray: true
}

const ACCOUNT_COLORS = ['#4f7cff', '#e5484d', '#30a46c', '#f76b15', '#8e4ec6', '#0090ff', '#d6409f']

const file = (): string => join(app.getPath('userData'), 'data.json')

let data: Data | null = null

function load(): Data {
  if (data) return data
  try {
    data = JSON.parse(readFileSync(file(), 'utf8')) as Data
  } catch {
    data = { accounts: [], calendars: [], cache: {} }
  }
  return data
}

function save(): void {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(file(), JSON.stringify(load(), null, 2))
}

export function getAccounts(): Account[] {
  return load().accounts.map(({ email, color }) => ({ email, color }))
}

export function getRefreshToken(email: string): string | null {
  const acc = load().accounts.find((a) => a.email === email)
  if (!acc) return null
  return safeStorage.decryptString(Buffer.from(acc.token, 'base64'))
}

export function saveAccount(email: string, refreshToken: string): Account {
  const d = load()
  const token = safeStorage.encryptString(refreshToken).toString('base64')
  const existing = d.accounts.find((a) => a.email === email)
  if (existing) {
    existing.token = token
  } else {
    const used = new Set(d.accounts.map((a) => a.color))
    const color = ACCOUNT_COLORS.find((c) => !used.has(c)) ?? ACCOUNT_COLORS[d.accounts.length % ACCOUNT_COLORS.length]
    d.accounts.push({ email, color, token })
  }
  save()
  return getAccounts().find((a) => a.email === email)!
}

export function removeAccount(email: string): void {
  const d = load()
  d.accounts = d.accounts.filter((a) => a.email !== email)
  d.calendars = d.calendars.filter((c) => c.accountEmail !== email)
  d.cache = {}
  save()
}

export function getCalendars(): CalendarInfo[] {
  return load().calendars
}

/** Replaces an account's calendar list, keeping the user's on/off choices. */
export function setAccountCalendars(email: string, fresh: CalendarInfo[]): void {
  const d = load()
  const previous = new Map(d.calendars.filter((c) => c.accountEmail === email).map((c) => [c.id, c.enabled]))
  const merged = fresh.map((c) => ({ ...c, enabled: previous.get(c.id) ?? c.enabled }))
  d.calendars = [...d.calendars.filter((c) => c.accountEmail !== email), ...merged]
  save()
}

export function setCalendarEnabled(email: string, id: string, enabled: boolean): void {
  const cal = load().calendars.find((c) => c.accountEmail === email && c.id === id)
  if (cal) {
    cal.enabled = enabled
    save()
  }
}

export function getCached(week: string): EventsResult | undefined {
  return load().cache[week]
}

export function setCached(week: string, result: EventsResult): void {
  const d = load()
  d.cache[week] = result
  // Keep only the 8 most recently fetched weeks
  const weeks = Object.keys(d.cache).sort((a, b) => d.cache[b].fetchedAt.localeCompare(d.cache[a].fetchedAt))
  for (const w of weeks.slice(8)) delete d.cache[w]
  save()
}

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...load().settings }
}

export function setSettings(changes: Partial<Settings>): Settings {
  load().settings = { ...getSettings(), ...changes }
  save()
  return getSettings()
}

export function clearCache(): void {
  load().cache = {}
  save()
}
