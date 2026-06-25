import { describe, it, expect } from 'vitest'
import { sanitizeMessageHtml } from '../utils/sanitizeHtml'

describe('sanitizeMessageHtml — XSS vectors stripped', () => {
  it('strips <script> tags entirely', () => {
    const result = sanitizeMessageHtml('<script>alert(1)</script>hi')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert')
    expect(result).toContain('hi')
  })

  it('strips <script> with attributes', () => {
    const result = sanitizeMessageHtml('<script src="evil.js" type="text/javascript"></script>safe')
    expect(result).not.toContain('<script')
    expect(result).toContain('safe')
  })

  it('strips onerror inline event handlers on <img>', () => {
    const result = sanitizeMessageHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  it('strips onclick inline event handlers', () => {
    const result = sanitizeMessageHtml('<span onclick="stealCookies()">click me</span>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('click me')
  })

  it('strips onmouseover event handler', () => {
    const result = sanitizeMessageHtml('<div onmouseover="evil()">hover</div>')
    expect(result).not.toContain('onmouseover')
  })

  it('strips javascript: URI in anchor href', () => {
    const result = sanitizeMessageHtml('<a href="javascript:alert(1)">x</a>')
    expect(result).not.toContain('javascript:')
  })

  it('strips javascript: URI with mixed case', () => {
    const result = sanitizeMessageHtml('<a href="JaVaScRiPt:alert(1)">x</a>')
    expect(result).not.toContain('avascript:')
    expect(result).not.toContain('href="JaVaScRiPt')
  })

  it('strips <iframe>', () => {
    const result = sanitizeMessageHtml('<iframe src="https://evil.com"></iframe>text')
    expect(result).not.toContain('<iframe')
    expect(result).toContain('text')
  })

  it('strips <embed>', () => {
    const result = sanitizeMessageHtml('<embed src="payload.swf">text')
    expect(result).not.toContain('<embed')
    expect(result).toContain('text')
  })

  it('strips <object>', () => {
    const result = sanitizeMessageHtml('<object data="evil.swf"></object>after')
    expect(result).not.toContain('<object')
    expect(result).toContain('after')
  })
})

describe('sanitizeMessageHtml — legitimate formatting preserved', () => {
  it('preserves <b> tag', () => {
    const result = sanitizeMessageHtml('<b>bold text</b>')
    expect(result).toContain('<b>bold text</b>')
  })

  it('preserves <strong> tag', () => {
    const result = sanitizeMessageHtml('<strong>important</strong>')
    expect(result).toContain('<strong>important</strong>')
  })

  it('preserves <a href="https://..."> anchor', () => {
    const result = sanitizeMessageHtml('<a href="https://example.com">link</a>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('link')
  })

  it('adds rel="noopener noreferrer nofollow" to links (tabnabbing defense)', () => {
    const result = sanitizeMessageHtml('<a href="https://example.com">link</a>')
    expect(result).toContain('rel="noopener noreferrer nofollow"')
  })

  it('preserves <ul><li> list structure', () => {
    const result = sanitizeMessageHtml('<ul><li>item 1</li><li>item 2</li></ul>')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>item 1</li>')
    expect(result).toContain('<li>item 2</li>')
  })

  it('preserves <ol> numbered list', () => {
    const result = sanitizeMessageHtml('<ol><li>first</li></ol>')
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>first</li>')
  })

  it('preserves safe inline style: color', () => {
    const result = sanitizeMessageHtml('<span style="color: red">colored</span>')
    // sanitize-html normalises CSS by stripping the space after ':'
    expect(result).toContain('color:red')
    expect(result).toContain('colored')
  })

  it('preserves safe inline style: color hex', () => {
    const result = sanitizeMessageHtml('<span style="color: #ff0000">red</span>')
    expect(result).toContain('color:#ff0000')
  })

  it('preserves text-align style', () => {
    const result = sanitizeMessageHtml('<p style="text-align: center">centered</p>')
    // sanitize-html normalises CSS by stripping the space after ':'
    expect(result).toContain('text-align:center')
  })

  it('preserves <blockquote>', () => {
    const result = sanitizeMessageHtml('<blockquote>quoted text</blockquote>')
    expect(result).toContain('<blockquote>')
    expect(result).toContain('quoted text')
  })

  it('preserves <code> and <pre>', () => {
    const result = sanitizeMessageHtml('<pre><code>const x = 1;</code></pre>')
    expect(result).toContain('<pre>')
    expect(result).toContain('<code>')
    expect(result).toContain('const x = 1;')
  })

  it('preserves heading tags h1-h3', () => {
    const result = sanitizeMessageHtml('<h1>Title</h1><h2>Sub</h2><h3>Sub2</h3>')
    expect(result).toContain('<h1>Title</h1>')
    expect(result).toContain('<h2>Sub</h2>')
    expect(result).toContain('<h3>Sub2</h3>')
  })
})

describe('sanitizeMessageHtml — dangerous style values stripped', () => {
  it('strips expression() from style (IE CSS injection)', () => {
    const result = sanitizeMessageHtml('<span style="width: expression(alert(1))">x</span>')
    expect(result).not.toContain('expression')
  })

  it('strips url() from style', () => {
    const result = sanitizeMessageHtml('<span style="background: url(javascript:alert(1))">x</span>')
    expect(result).not.toContain('url(')
  })
})

describe('sanitizeMessageHtml — edge cases', () => {
  it('returns empty string unchanged when falsy', () => {
    expect(sanitizeMessageHtml('')).toBe('')
  })

  it('handles plain text without HTML', () => {
    const result = sanitizeMessageHtml('Hello world')
    expect(result).toBe('Hello world')
  })

  it('does not escape regular ampersands in text', () => {
    const result = sanitizeMessageHtml('Tom &amp; Jerry')
    expect(result).toContain('Tom')
    expect(result).toContain('Jerry')
  })
})
