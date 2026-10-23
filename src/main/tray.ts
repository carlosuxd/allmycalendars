import { Menu, nativeImage, Tray } from 'electron'
import * as notifier from './notifier'
import * as store from './store'

interface Options {
  icon: string
  showWindow(): void
  openEvent(key: string, start: string): void
  quit(): void
}

let tray: Tray | null = null
let opts: Options

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function update(): void {
  if (!tray) return
  const next = notifier.nextMeeting()
  const settings = store.getSettings()
  let nextLabel = 'No upcoming meetings'
  if (next) {
    const start = new Date(next.start)
    const time = start.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    nextLabel = `Next: ${truncate(next.title, 40)} · ${start.getTime() <= Date.now() ? 'now' : time}`
  }
  tray.setToolTip(next ? `All My Calendars\n${nextLabel}` : 'All My Calendars')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open All My Calendars', click: opts.showWindow },
      { type: 'separator' },
      { label: nextLabel, enabled: Boolean(next), click: () => next && opts.openEvent(next.key, next.start) },
      { type: 'separator' },
      {
        label: 'Meeting notifications',
        type: 'checkbox',
        checked: settings.notifications,
        click: (item) => store.setSettings({ notifications: item.checked })
      },
      { label: 'Quit', click: opts.quit }
    ])
  )
}

export function create(options: Options): void {
  opts = options
  const size = process.platform === 'darwin' ? 18 : 16
  const image = nativeImage.createFromPath(opts.icon).resize({ width: size, height: size, quality: 'best' })
  tray = new Tray(image)
  tray.on('click', opts.showWindow)
  update()
}
