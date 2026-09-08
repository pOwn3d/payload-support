import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function collect(directory: string, match: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collect(path, match)
    return match.test(entry.name) ? [path] : []
  })
}

/** End of the opening tag that starts at `from`, skipping braced expressions. */
function openingTagEnd(source: string, from: number): number {
  let depth = 0
  for (let i = from; i < source.length; i += 1) {
    const char = source[i]
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    else if (char === '>' && depth === 0) return i
  }
  return source.length
}

function locate(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

const componentFiles = collect(join(process.cwd(), 'src/components'), /\.tsx$/)

describe('buttons inside the Payload document form', () => {
  /**
   * Everything under src/components is mounted by Payload as a field of the
   * Tickets edit view, and that view is a real `<form>`
   * (@payloadcms/ui Form renders `el || 'form'`). A `<button>` with no `type`
   * defaults to `type="submit"`, so clicking "Merge" or "Snooze" — none of
   * which call preventDefault — would also save the document, and Enter in the
   * search field would fire the first button of the list.
   */
  const offenders = componentFiles.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const hits: string[] = []

    for (const match of source.matchAll(/<button\b/g)) {
      const tag = source.slice(match.index, openingTagEnd(source, match.index + 7))
      if (!/\btype\s*=/.test(tag)) {
        hits.push(`${file.replace(process.cwd() + '/', '')}:${locate(source, match.index)}`)
      }
    }

    return hits
  })

  it('scans a non-empty set of files', () => {
    expect(componentFiles.length).toBeGreaterThan(5)
  })

  it('all declare an explicit type', () => {
    expect(offenders).toEqual([])
  })
})

describe('form controls', () => {
  /**
   * A control with no accessible name is a dead end for a screen-reader user:
   * it is announced as "edit text, blank". Either a sibling `<label htmlFor>`
   * or an `aria-label` — never the placeholder, which is often an example
   * ("TK-0001", "sk-...") rather than a name.
   */
  const files = [
    ...componentFiles,
    ...collect(join(process.cwd(), 'src/views'), /\.tsx$/),
  ]

  const offenders = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const hits: string[] = []

    for (const match of source.matchAll(/<(input|select|textarea)\b/g)) {
      const tag = source.slice(match.index, openingTagEnd(source, match.index + match[0].length))
      if (/aria-label|aria-labelledby|\bid=/.test(tag)) continue

      // `<label><input/> text</label>` names the control implicitly.
      const preceding = source.slice(Math.max(0, match.index - 200), match.index)
      if (preceding.split('</label>').pop()!.includes('<label')) continue

      hits.push(`${file.replace(process.cwd() + '/', '')}:${locate(source, match.index)}`)
    }

    return hits
  })

  it('all carry an accessible name', () => {
    expect(offenders).toEqual([])
  })
})

describe('focus visibility', () => {
  /**
   * `outline: 'none'` written as an inline style cannot be paired with a
   * `:focus` rule, so it removes the focus ring outright. It is only
   * acceptable when the same element restores an indicator through an
   * onFocus/onBlur handler.
   */
  const files = [
    ...componentFiles,
    ...collect(join(process.cwd(), 'src/views'), /\.tsx$/),
  ]

  const offenders = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    if (!/outline:\s*'none'/.test(source)) return []
    if (/onFocus=/.test(source)) return []
    return [file.replace(process.cwd() + '/', '')]
  })

  it('no admin component kills the focus ring without replacing it', () => {
    expect(offenders).toEqual([])
  })
})

describe('secondary text colour', () => {
  /**
   * Payload's dark theme redefines elevation-450 then 550 and skips 500, so
   * `--theme-elevation-500` stays rgb(128,128,128) in both themes: 3.62:1 on a
   * light background, 4.03:1 on a dark one. Below AA either way. It is fine as
   * a background or a border, never as a foreground.
   */
  const files = [
    ...collect(join(process.cwd(), 'src'), /\.scss$/),
    ...collect(join(process.cwd(), 'src'), /\.tsx$/),
  ].filter((file) => !file.includes('__tests__'))

  it('is never used as a foreground colour', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/color:[^;\n]*--theme-elevation-500\b/g)].map(
        (match) => `${file.replace(process.cwd() + '/', '')}:${locate(source, match.index)}`,
      )
    })

    expect(offenders).toEqual([])
  })
})

describe('clickable table rows', () => {
  /**
   * A `<tr onClick>` is unreachable by keyboard, and `role="button"` on a row
   * would destroy the association between cells and column headers. The
   * control belongs inside a cell.
   */
  const viewFiles = collect(join(process.cwd(), 'src/views'), /\.tsx$/)

  it('carry no row-level click handler', () => {
    const offenders = viewFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/<tr\b[^>]*\bonClick=/g)].map(
        (match) => `${file.replace(process.cwd() + '/', '')}:${locate(source, match.index)}`,
      )
    })

    expect(offenders).toEqual([])
  })
})

/**
 * A roving tabindex is half of the ARIA tablist pattern. The other half is the
 * arrow-key handler that moves between the tabs the roving index just removed
 * from the tab order.
 *
 * This is a regression guard, not a hypothetical: the accessibility pass added
 * `tabIndex={-1}` to the inbox tabs and shipped without the handler, which left
 * four of the five tabs unreachable from the keyboard — strictly worse than the
 * plain tab order it replaced. A source-level assertion is the right shape here
 * because the component cannot be mounted in this suite (it pulls the whole
 * admin client tree), and the defect is exactly a *missing* piece of source.
 */
describe('roving tabindex always ships with its key handler', () => {
  const SRC = join(process.cwd(), 'src')

  it('the inbox tablist handles arrows, Home and End', () => {
    const src = readFileSync(join(SRC, 'views/TicketInboxView/client.tsx'), 'utf8')

    // Precondition: this file is the one that uses a roving tabindex.
    expect(src).toMatch(/role="tablist"/)
    expect(src).toMatch(/tabIndex=\{tab === tk\.key \? 0 : -1\}/)

    const handler = src.slice(src.indexOf('role="tablist"'))
    expect(handler).toMatch(/onKeyDown=/)
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(handler).toContain(key)
    }
  })

  it('no other file introduces a roving tabindex without a key handler', () => {
    const offenders: string[] = []
    for (const file of collect(SRC, /\.tsx$/)) {
      const src = readFileSync(file, 'utf8')
      if (!/role="tablist"/.test(src)) continue
      if (!/tabIndex=\{[^}]*-1/.test(src)) continue
      if (!/onKeyDown=/.test(src)) offenders.push(file.replace(SRC, ''))
    }
    expect(offenders).toEqual([])
  })
})
