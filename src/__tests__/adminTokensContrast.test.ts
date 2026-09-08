import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { V, btnStyle } from '../views/shared/adminTokens'

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ]
}

function contrast(a: string, b: string): number {
  const la = luminance(parseHex(a))
  const lb = luminance(parseHex(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE = '#ffffff'

describe('admin palette contrast', () => {
  // Every fixed hex of the palette is only ever used as a button background
  // behind the default white foreground of btnStyle.
  const hexTokens = Object.entries(V).filter(([, value]) => value.startsWith('#'))

  it('has the palette entries the views rely on', () => {
    expect(hexTokens.map(([name]) => name).sort()).toEqual(
      ['amber', 'blue', 'cyan', 'green', 'orange', 'red', 'yellow'],
    )
  })

  it.each(hexTokens)('keeps white readable on V.%s (AA, 4.5:1)', (_name, value) => {
    expect(contrast(WHITE, value)).toBeGreaterThanOrEqual(4.5)
  })

  it('defaults btnStyle to white, which the palette above is calibrated for', () => {
    expect(btnStyle(V.blue).color).toBe('#fff')
  })

  it('lets a caller override the foreground for theme-variable backgrounds', () => {
    const style = btnStyle(V.neutralBg, { fg: V.neutralFg })
    expect(style.backgroundColor).toBe('var(--theme-elevation-150)')
    expect(style.color).toBe('var(--theme-text)')
  })
})

describe('secondary text token', () => {
  it('avoids --theme-elevation-500, which Payload leaves at rgb(128,128,128) in both themes', () => {
    // colors.scss redefines 450 then 550 in html[data-theme='dark'] and skips
    // 500, so elevation-500 is 3.62:1 in light and 4.03:1 in dark.
    expect(V.textSecondary).not.toContain('elevation-500')
    expect(V.textSecondary).toBe('var(--theme-elevation-650)')
  })

  it('is not reintroduced as a button background with the default white text', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/views/TicketingSettingsView/client.tsx'),
      'utf8',
    )
    // White on a theme variable is unreadable in one of the two themes.
    expect(source).not.toMatch(/btnStyle\(\s*'var\(--theme-elevation-\d+\)'\s*,\s*\{\s*small: true\s*\}\)/)
  })
})
