import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderAiSummary } from '../components/TicketConversation/components/AISummaryPanel'

describe('AI summary rendering', () => {
  it('escapes model-provided HTML instead of interpreting it', () => {
    const nodes = renderAiSummary('<img src=x onerror=alert(1)>')
    expect(nodes).toEqual(['<img src=x onerror=alert(1)>'])
    expect(React.isValidElement(nodes[0])).toBe(false)
  })

  it('preserves bold markdown and line breaks without raw HTML', () => {
    const nodes = renderAiSummary('**Résumé**\nSuite')
    expect(React.isValidElement(nodes[0])).toBe(true)
    expect((nodes[0] as React.ReactElement).type).toBe('strong')
    expect((nodes[0] as React.ReactElement<{ children: string }>).props.children).toBe('Résumé')
    expect(React.isValidElement(nodes[1])).toBe(true)
    expect((nodes[1] as React.ReactElement).type).toBe('br')
    expect(nodes[2]).toBe('Suite')
  })
})
