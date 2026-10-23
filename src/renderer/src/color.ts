import { useEffect, useState } from 'react'

// WCAG 2.x contrast helpers. Calendar colors come from Google and can be any
// hex, so readable text colors are calculated from the real background.

type RGB = [number, number, number]

export const DARK_TEXT = '#1c2024'
export const LIGHT_TEXT = '#ffffff'

/** Must match the theme tokens in styles.css */
export const THEME = {
  light: { bg: '#ffffff', bgSoft: '#f6f7f9', text: '#1c2024', muted: '#6b7280' },
  dark: { bg: '#17181b', bgSoft: '#1e2024', text: '#e8eaed', muted: '#9aa0a8' }
}

function parse(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `amount` of `color` blended over `base`, like CSS color-mix(in srgb, color amount, base). */
export function mix(color: string, base: string, amount: number): string {
  const c = parse(color)
  const b = parse(base)
  return toHex([0, 1, 2].map((i) => c[i] * amount + b[i] * (1 - amount)) as RGB)
}

/** Near-black or white, whichever reads better on `bg`. */
export function readableText(bg: string): string {
  return contrast(DARK_TEXT, bg) >= contrast(LIGHT_TEXT, bg) ? DARK_TEXT : LIGHT_TEXT
}

/** Keeps `fg` if it reaches `ratio` on `bg`, otherwise moves it toward the most readable text color until it does. */
export function ensureContrast(fg: string, bg: string, ratio = 4.5): string {
  const target = readableText(bg)
  for (let t = 0; t <= 1; t += 0.1) {
    const candidate = mix(target, fg, t)
    if (contrast(candidate, bg) >= ratio) return candidate
  }
  return target
}

export function useDarkMode(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (): void => setDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export interface EventColors {
  bg: string
  hoverBg: string
  fg: string
  muted: string
  border: string
}

/** Colors for a timed event block, readable in both themes and for past events. */
export function eventColors(color: string, dark: boolean, past: boolean): EventColors {
  const theme = dark ? THEME.dark : THEME.light
  const amount = past ? (dark ? 0.14 : 0.08) : dark ? 0.3 : 0.18
  const bg = mix(color, theme.bg, amount)
  const hoverBg = mix(color, theme.bg, amount + 0.1)
  return {
    bg,
    hoverBg,
    fg: readableText(bg),
    // Must stay readable on both the normal and the hover background
    muted: ensureContrast(ensureContrast(theme.muted, bg), hoverBg),
    border: past ? mix(color, theme.bg, 0.5) : color
  }
}

/**
 * Background and text for an all-day chip. Mid-tone colors (e.g. Google's brown or teal)
 * reach 4.5:1 with neither black nor white, so the background is nudged darker or lighter
 * just enough for the text to pass.
 */
export function chipColors(color: string): { bg: string; fg: string } {
  const fg = readableText(color)
  const toward = fg === LIGHT_TEXT ? '#000000' : '#ffffff'
  for (let t = 0; t <= 1; t += 0.05) {
    const bg = mix(toward, color, t)
    if (contrast(fg, bg) >= 4.5) return { bg, fg }
  }
  return { bg: toward === '#000000' ? '#000000' : '#ffffff', fg }
}

/** An account dot color that stands out 3:1 (WCAG non-text contrast) on every background it sits on. */
export function dotColor(accountColor: string, ...backgrounds: string[]): string {
  return backgrounds.reduce((c, bg) => ensureContrast(c, bg, 3), accountColor)
}

/**
 * The account's dot color, used everywhere (sidebar, settings, calendar items) so they match.
 * Dots on calendar items get a cut-out edge in the page color, so they only need 3:1 against
 * the page background, not against each calendar color.
 */
export function accountDotColor(accountColor: string, dark: boolean): string {
  const t = dark ? THEME.dark : THEME.light
  return dotColor(accountColor, t.bg, t.bgSoft)
}
