import type React from 'react'

// Shared design tokens for all admin views (professional style)
export const V = {
  text: 'var(--theme-text)',
  // elevation-650, not elevation-500: Payload's dark theme does not redefine
  // the 500 step (colors.scss jumps from 450 to 550), so elevation-500 stays
  // rgb(128,128,128) in both themes — 3.62:1 on a light background and 4.03:1
  // on a dark one, below WCAG AA in both. elevation-650 gives 6.63:1 / 9.03:1.
  textSecondary: 'var(--theme-elevation-650)',
  bg: 'var(--theme-elevation-50)',
  bgCard: 'var(--theme-elevation-100)',
  border: 'var(--theme-elevation-300)',
  // Professional palette. These are fixed hex values (they do not follow the
  // admin theme), so they are only ever used as a background behind white
  // text; each one is dark enough for white to reach at least 4.5:1.
  blue: '#2563eb', // white on it: 5.17:1
  amber: '#b45309', // white on it: 5.02:1
  orange: '#c2410c', // white on it: 5.18:1
  green: '#15803d', // white on it: 5.02:1
  red: '#dc2626', // white on it: 4.83:1
  // Neutral / secondary button. Both halves follow the admin theme, so they
  // must be used together — white on a theme token is unreadable in one of
  // the two themes whichever token is picked.
  neutralBg: 'var(--theme-elevation-150)',
  neutralFg: 'var(--theme-text)',
  // Legacy aliases (backward compat for views not yet updated)
  cyan: '#2563eb',
  yellow: '#b45309',
} as const

/**
 * Button style factory.
 *
 * `bg` is expected to be one of the fixed hex values of `V`; the default
 * foreground is white, which reaches AA on all of them. Pass `fg` whenever
 * `bg` is a theme variable, since white only works on one of the two themes.
 */
export const btnStyle = (
  bg: string,
  opts?: { disabled?: boolean; small?: boolean; fg?: string },
): React.CSSProperties => ({
  padding: opts?.small ? '6px 12px' : '8px 14px',
  borderRadius: 6,
  border: `1px solid var(--theme-elevation-300)`,
  backgroundColor: bg,
  color: opts?.fg ?? '#fff',
  fontWeight: 600,
  fontSize: opts?.small ? 12 : 13,
  cursor: opts?.disabled ? 'not-allowed' : 'pointer',
  opacity: opts?.disabled ? 0.5 : 1,
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
})
