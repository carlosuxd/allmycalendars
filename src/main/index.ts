import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import * as auth from './auth'
import * as google from './google'
import * as store from './store'
import * as notifier from './notifier'
import * as tray from './tray'
import { loadWeek } from './events'
import type { Settings } from '@shared/types'
import icon from '../../resources/icon.png?asset'

const FOCUS_REFRESH_MIN_GAP_MS = 60 * 1000

let win: BrowserWindow | null = null
let lastSync = 0
let isQuitting = false

function openSafely(url: string): void {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

/** Matches --bg in styles.css, so the window doesn't flash white in dark mode */
function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#17181b' : '#ffffff'
}

function applyTheme(): void {
  // The CSS follows prefers-color-scheme, which follows this
  nativeTheme.themeSource = store.getSettings().theme
  win?.setBackgroundColor(windowBackground())
}

function syncNow(): void {
  lastSync = Date.now()
  void notifier.sync()
}

function showWindow(): void {
  if (!win) createWindow()
  if (win!.isMinimized()) win!.restore()
  win!.show()
  win!.focus()
}

/** Bring the window up with this meeting's details open. */
function openEvent(key: string, start: string): void {
  showWindow()
  const send = (): void => win?.webContents.send('select-event', key, start)
  if (win!.webContents.isLoading()) win!.webContents.once('did-finish-load', send)
  else send()
}

function quit(): void {
  isQuitting = true
  app.quit()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 420,
    minHeight: 500,
    title: 'All My Calendars',
    icon, // Windows title bar and taskbar; installed builds use build/icon.png
    backgroundColor: windowBackground(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      // No text fields to check, and the spellchecker can download dictionaries from the internet
      spellcheck: false
    }
  })

  // Links inside the app always open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    openSafely(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) {
      e.preventDefault()
      openSafely(url)
    }
  })
  win.on('focus', () => {
    if (Date.now() - lastSync > FOCUS_REFRESH_MIN_GAP_MS) syncNow()
  })
  // Closing the window keeps the app running in the tray so reminders still arrive
  win.on('close', (e) => {
    if (!isQuitting && store.getSettings().keepInTray) {
      e.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => (win = null))

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('isConfigured', () => auth.isConfigured())
ipcMain.handle('getAccounts', () => store.getAccounts())
ipcMain.handle('addAccount', async () => {
  const account = await auth.signIn()
  store.setAccountCalendars(account.email, await google.fetchCalendars(account.email))
  win?.focus()
  syncNow()
  return account
})
ipcMain.handle('removeAccount', (_e, email: string) => {
  auth.forget(email)
  store.removeAccount(email)
  syncNow()
})
ipcMain.handle('getCalendars', () => store.getCalendars())
ipcMain.handle('refreshCalendars', () => google.refreshAllCalendars())
ipcMain.handle('setCalendarEnabled', (_e, email: string, id: string, enabled: boolean) => {
  store.setCalendarEnabled(email, id, enabled)
  syncNow()
})
ipcMain.handle('openExternal', (_e, url: string) => openSafely(url))
ipcMain.handle('getEvents', (_e, weekStartIso: string, force?: boolean) => loadWeek(weekStartIso, force))
ipcMain.handle('getSettings', () => store.getSettings())
ipcMain.handle('setSettings', (_e, changes: Partial<Settings>) => {
  const settings = store.setSettings(changes)
  // --hidden: start in the tray instead of opening the window (Windows; macOS uses wasOpenedAtLogin)
  if ('openAtLogin' in changes) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin, args: ['--hidden'] })
  if ('theme' in changes) applyTheme()
  tray.update()
  return settings
})
ipcMain.handle('testNotification', () => notifier.showTest())
ipcMain.handle('getAppInfo', () => ({ version: app.getVersion(), dataPath: app.getPath('userData') }))
ipcMain.handle('openDataFolder', () => shell.openPath(app.getPath('userData')))
ipcMain.handle('clearCache', () => {
  store.clearCache()
  syncNow()
})

// Launching the app again just brings up the running one
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    // Windows only shows notifications for apps with an ID
    if (process.platform === 'win32') app.setAppUserModelId('com.carlos.allmycalendars')
    // In development the Mac Dock would otherwise show the default Electron icon
    if (process.platform === 'darwin') app.dock?.setIcon(icon)
    applyTheme()

    const startedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden')
    if (!startedAtLogin) createWindow()

    tray.create({ icon, showWindow, openEvent, quit })
    notifier.start({
      icon,
      openEvent,
      onSynced: () => {
        tray.update()
        // The window reads the freshly synced cache
        win?.webContents.send('refresh')
      }
    })
    lastSync = Date.now()

    app.on('activate', showWindow)
  })

  app.on('before-quit', () => (isQuitting = true))
  // Stay alive in the tray when the window is closed, unless the user turned that off
  app.on('window-all-closed', () => {
    if (!store.getSettings().keepInTray) quit()
  })
}
