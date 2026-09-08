import React from 'react'
import { describe, expect, it } from 'vitest'
import * as adminIcons from '../views/shared/icons'
import * as portalIcons from '../portal/icons'

type IconModule = Record<string, React.FC<{ size?: number | string }>>

function svgOf(Icon: React.FC<{ size?: number | string }>, props = {}): React.ReactElement {
  return Icon(props) as unknown as React.ReactElement
}

/**
 * `lucide-react` was a REQUIRED peer dependency for these 19 icons: a host that
 * did not install it failed at build time. They are inlined instead, and this
 * suite is what guarantees the replacements still render an icon rather than an
 * empty `<svg>`.
 */
describe('inlined icons', () => {
  const admin = Object.entries(adminIcons as IconModule)
  const portal = Object.entries(portalIcons as IconModule)

  it('covers exactly the icons the source imports', () => {
    expect(admin.map(([name]) => name).sort()).toEqual([
      'Bot', 'ChevronDown', 'ChevronUp', 'Clock', 'FileSignature', 'Globe', 'Inbox',
      'Link2', 'Mail', 'Paperclip', 'Plus', 'Search', 'Settings', 'Timer', 'X',
    ])
    expect(portal.map(([name]) => name).sort()).toEqual([
      'ArrowLeft', 'MessageCircle', 'Minimize2', 'Send', 'X',
    ])
  })

  it.each([...admin, ...portal])('%s draws at least one shape', (_name, Icon) => {
    const svg = svgOf(Icon)
    const children = (svg.props as { children: React.ReactElement[] }).children

    expect(children.length).toBeGreaterThan(0)
    for (const child of children) {
      expect(['path', 'circle', 'line', 'rect', 'polyline']).toContain(child.type)
      // Every shape must carry actual geometry, not just a key.
      expect(Object.keys(child.props as object).length).toBeGreaterThan(0)
    }
  })

  it.each([...admin, ...portal])('%s inherits the current colour and is decorative', (_name, Icon) => {
    const props = svgOf(Icon).props as Record<string, unknown>

    expect(props.stroke).toBe('currentColor')
    expect(props.fill).toBe('none')
    expect(props.viewBox).toBe('0 0 24 24')
    // The controls that contain nothing but an icon carry their own aria-label.
    expect(props['aria-hidden']).toBe('true')
  })

  it('honours size and lets callers override any attribute', () => {
    const props = svgOf(adminIcons.Search, { size: 16, 'aria-hidden': false }).props as Record<string, unknown>

    expect(props.width).toBe(16)
    expect(props.height).toBe(16)
    expect(props['aria-hidden']).toBe(false)
  })

  it('leaves no import of lucide-react in the package', () => {
    // The peer dependency is gone; a stray import would break every install.
    const { readFileSync, readdirSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return walk(path)
        return /\.tsx?$/.test(entry.name) ? [path] : []
      })

    const offenders = walk(join(process.cwd(), 'src'))
      .filter((file) => !file.includes('__tests__'))
      .filter((file) => /from '[^']*lucide-react'/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  it('is not declared as a peer dependency any more', () => {
    const pkg = JSON.parse(
      (require('node:fs') as typeof import('node:fs')).readFileSync('package.json', 'utf8'),
    )
    expect(pkg.peerDependencies['lucide-react']).toBeUndefined()
  })
})
