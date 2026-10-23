import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, JSX } from 'react'
import { CheckIcon, PaletteIcon } from '@phosphor-icons/react'
import { accountDotColor, readableText, useDarkMode } from '../../color'

const PRESETS: { color: string; name: string }[] = [
  { color: '#4f7cff', name: 'Blue' },
  { color: '#0090ff', name: 'Sky' },
  { color: '#12a594', name: 'Teal' },
  { color: '#30a46c', name: 'Green' },
  { color: '#ffb224', name: 'Amber' },
  { color: '#f76b15', name: 'Orange' },
  { color: '#e5484d', name: 'Red' },
  { color: '#d6409f', name: 'Pink' },
  { color: '#8e4ec6', name: 'Purple' },
  { color: '#6e56cf', name: 'Indigo' }
]

interface Props {
  color: string
  /** Who the color is for, used in labels: "Personal" or the email */
  name: string
  onChange(color: string): void
}

/** The account's dot as a button that opens a palette of dot colors. */
export function AccountColorPicker({ color, name, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const dark = useDarkMode()
  const root = useRef<HTMLDivElement>(null)
  const swatches = useRef<(HTMLButtonElement | null)[]>([])
  const current = color.toLowerCase()
  const isPreset = PRESETS.some((p) => p.color === current)

  // Close on outside click; focus the selected swatch when opening
  useEffect(() => {
    if (!open) return
    const selected = PRESETS.findIndex((p) => p.color === current)
    swatches.current[Math.max(0, selected)]?.focus()
    const onDown = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, current])

  const pick = (c: string): void => {
    onChange(c)
    setOpen(false)
  }

  const onKeyDown = (e: ReactKeyboardEvent): void => {
    if (e.key === 'Escape') {
      // Close only the palette, not Settings
      e.stopPropagation()
      setOpen(false)
      return
    }
    const i = swatches.current.findIndex((b) => b === document.activeElement)
    if (i < 0) return
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }[e.key]
    if (step) {
      e.preventDefault()
      swatches.current[(i + step + PRESETS.length) % PRESETS.length]?.focus()
    }
  }

  return (
    <div className="color-picker" ref={root} onKeyDown={onKeyDown}>
      <button
        className="color-trigger"
        style={{ background: accountDotColor(color, dark) }}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Dot color for ${name}`}
        title="Change dot color"
      />
      {open && (
        <div className="color-popover" role="dialog" aria-label={`Dot color for ${name}`}>
          <div className="swatch-grid" role="radiogroup" aria-label="Preset colors">
            {PRESETS.map((p, i) => (
              <button
                key={p.color}
                ref={(el) => {
                  swatches.current[i] = el
                }}
                className="swatch"
                role="radio"
                aria-checked={p.color === current}
                aria-label={p.name}
                title={p.name}
                style={{ background: accountDotColor(p.color, dark), color: readableText(accountDotColor(p.color, dark)) }}
                onClick={() => pick(p.color)}
              >
                {p.color === current && <CheckIcon size={14} weight="bold" aria-hidden />}
              </button>
            ))}
          </div>
          <label className="custom-color btn-icon">
            <PaletteIcon size={16} aria-hidden />
            {isPreset ? 'Custom color…' : 'Custom color (selected)'}
            <input type="color" value={current} onChange={(e) => onChange(e.target.value)} />
          </label>
          <p className="muted small">Very light colors are darkened slightly so the dot stays visible.</p>
        </div>
      )}
    </div>
  )
}
