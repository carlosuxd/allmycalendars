import { contextBridge, ipcRenderer } from 'electron'
import type { Api, UpdateStatus } from '@shared/types'

const api: Api = {
  isConfigured: () => ipcRenderer.invoke('isConfigured'),
  getAccounts: () => ipcRenderer.invoke('getAccounts'),
  updateAccount: (email, changes) => ipcRenderer.invoke('updateAccount', email, changes),
  reorderAccounts: (emails) => ipcRenderer.invoke('reorderAccounts', emails),
  cancelSignIn: () => ipcRenderer.invoke('cancelSignIn'),
  reopenSignIn: () => ipcRenderer.invoke('reopenSignIn'),
  addAccount: () => ipcRenderer.invoke('addAccount'),
  removeAccount: (email) => ipcRenderer.invoke('removeAccount', email),
  getCalendars: () => ipcRenderer.invoke('getCalendars'),
  refreshCalendars: () => ipcRenderer.invoke('refreshCalendars'),
  setCalendarEnabled: (email, id, enabled) => ipcRenderer.invoke('setCalendarEnabled', email, id, enabled),
  getEvents: (weekStartIso, force) => ipcRenderer.invoke('getEvents', weekStartIso, force),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  getChromeProfiles: () => ipcRenderer.invoke('getChromeProfiles'),
  openInChromeProfile: (url, dir) => ipcRenderer.invoke('openInChromeProfile', url, dir),
  onRefresh: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('refresh', listener)
    return () => ipcRenderer.removeListener('refresh', listener)
  },
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSettings: (changes) => ipcRenderer.invoke('setSettings', changes),
  testNotification: () => ipcRenderer.invoke('testNotification'),
  syncNow: () => ipcRenderer.invoke('syncNow'),
  getAppInfo: () => ipcRenderer.invoke('getAppInfo'),
  openDataFolder: () => ipcRenderer.invoke('openDataFolder'),
  clearCache: () => ipcRenderer.invoke('clearCache'),
  getUpdateStatus: () => ipcRenderer.invoke('getUpdateStatus'),
  checkForUpdates: () => ipcRenderer.invoke('checkForUpdates'),
  installUpdate: () => ipcRenderer.invoke('installUpdate'),
  onUpdateStatus: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => cb(status)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  onSelectEvent: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, key: string, start: string): void => cb(key, start)
    ipcRenderer.on('select-event', listener)
    return () => ipcRenderer.removeListener('select-event', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
