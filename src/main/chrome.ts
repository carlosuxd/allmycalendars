import { nativeImage } from 'electron'
import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { ChromeProfile } from '@shared/types'

// Lets Join open a meeting in a specific Chrome profile. Everything here reads Chrome's own
// files on this computer; nothing is stored or sent anywhere.

function userDataDir(): string | null {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data')
  }
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
  return null
}

/** Path to Chrome, or null when it isn't installed. */
export function findChrome(): string | null {
  if (process.platform === 'darwin') {
    const app = '/Applications/Google Chrome.app'
    return existsSync(app) ? app : null
  }
  if (process.platform !== 'win32') return null
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
  for (const root of roots) {
    if (!root) continue
    const exe = join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')
    if (existsSync(exe)) return exe
  }
  return null
}

interface LocalState {
  profile?: {
    profiles_order?: string[]
    info_cache?: Record<string, { name?: string; user_name?: string; gaia_picture_file_name?: string }>
  }
}

/** Chrome's profiles in Chrome's own order; [] if Chrome or its profile list isn't there. */
export function listProfiles(): ChromeProfile[] {
  const dataDir = userDataDir()
  if (!dataDir || !findChrome()) return []
  try {
    const state = JSON.parse(readFileSync(join(dataDir, 'Local State'), 'utf8')) as LocalState
    const cache = state.profile?.info_cache ?? {}
    const order = state.profile?.profiles_order ?? []
    const dirs = [...order.filter((d) => d in cache), ...Object.keys(cache).filter((d) => !order.includes(d))]
    return dirs.map((dir) => {
      const info = cache[dir]
      let avatar: string | undefined
      if (info.gaia_picture_file_name) {
        const img = nativeImage.createFromPath(join(dataDir, dir, info.gaia_picture_file_name))
        if (!img.isEmpty()) avatar = img.resize({ width: 48, height: 48, quality: 'best' }).toDataURL()
      }
      return { dir, name: info.name || dir, email: info.user_name || undefined, avatar }
    })
  } catch {
    return []
  }
}

/** Opens `url` in the given Chrome profile. Only http(s) links and existing profiles are accepted. */
export function openInProfile(url: string, dir: string): boolean {
  const chrome = findChrome()
  if (!chrome || !/^https?:\/\//i.test(url) || !listProfiles().some((p) => p.dir === dir)) return false
  const profileArg = `--profile-directory=${dir}`
  // Arguments are passed as a list (no shell), so the URL and folder name can't inject anything
  const child =
    process.platform === 'darwin'
      ? spawn('open', ['-na', chrome, '--args', profileArg, url], { detached: true, stdio: 'ignore' })
      : spawn(chrome, [profileArg, url], { detached: true, stdio: 'ignore' })
  child.unref()
  return true
}
