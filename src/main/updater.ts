import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

/** Wait a little after launch so the update check doesn't compete with the first sync */
const LAUNCH_CHECK_DELAY_MS = 10 * 1000

interface Options {
  /** Called on every status change, e.g. to tell the window and update the tray */
  onStatus(status: UpdateStatus): void
  /** Called once when an update has downloaded */
  onReady(version: string): void
  /** Lets the window really close instead of hiding to the tray */
  prepareToQuit(): void
}

let opts: Options
let status: UpdateStatus = { state: 'idle' }
/** Errors from the launch check stay quiet (e.g. offline); only a manual check reports them */
let manual = false

function set(next: UpdateStatus): void {
  status = next
  opts.onStatus(status)
}

export function getStatus(): UpdateStatus {
  return status
}

/** Updates come from the installed app's feed (app-update.yml), so dev builds can't check */
export function isSupported(): boolean {
  return app.isPackaged
}

export async function check(isManual = true): Promise<void> {
  if (!isSupported()) return
  // Once downloaded there's nothing more to check until the restart
  if (status.state === 'ready' || status.state === 'downloading' || status.state === 'checking') return
  manual = isManual
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // Reported through the 'error' event
  }
}

export function restartAndInstall(): void {
  if (status.state !== 'ready') return
  opts.prepareToQuit()
  autoUpdater.quitAndInstall()
}

export function start(options: Options): void {
  opts = options
  if (!isSupported()) return

  autoUpdater.autoDownload = true
  // Ignoring "Restart now" still installs the update the next time the app quits
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: manual ? 'up-to-date' : 'idle' }))
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) =>
    set({ state: 'downloading', version: status.version, percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version })
    opts.onReady(info.version)
  })
  autoUpdater.on('error', (err) => {
    // The updater's own messages are long HTTP dumps; keep the window's message short
    const offline = /ENOTFOUND|ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|net::ERR_/.test(err.message)
    const message = offline ? 'Check your internet connection.' : 'Please try again later.'
    set(manual ? { state: 'error', message } : { state: 'idle' })
  })

  setTimeout(() => void check(false), LAUNCH_CHECK_DELAY_MS)
}
