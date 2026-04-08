'use client'

import React, { useState, useRef, useEffect } from 'react'

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'diff', label: 'Diff' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'docker', label: 'Dockerfile' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'env', label: '.env' },
]

interface CodeBlockInserterProps {
  onInsert: (block: string) => void
  className?: string
  style?: React.CSSProperties
}

/**
 * Toolbar button that opens a language picker dropdown.
 * When a language is selected, calls onInsert with the fenced code block template.
 */
export function CodeBlockInserter({ onInsert, className, style }: CodeBlockInserterProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = filter
    ? LANGUAGES.filter((l) => l.label.toLowerCase().includes(filter.toLowerCase()) || l.value.includes(filter.toLowerCase()))
    : LANGUAGES

  const handleSelect = (lang: string) => {
    onInsert(`\n\`\`\`${lang}\n\n\`\`\`\n`)
    setOpen(false)
    setFilter('')
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        className={className}
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 10px',
          width: 'auto',
          cursor: 'pointer',
          ...style,
        }}
        type="button"
        aria-label="Insérer un bloc de code"
        data-tooltip="Bloc de code"
      >
        &lt;/&gt; Code
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: 4,
          width: 200,
          maxHeight: 280,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setFilter('') }
                if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].value)
              }}
              placeholder="Rechercher..."
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 6,
                color: '#e2e8f0',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 230, padding: '4px 0' }}>
            {filtered.map((lang) => (
              <button
                key={lang.value}
                onClick={() => handleSelect(lang.value)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#e2e8f0',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#334155' }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent' }}
                type="button"
              >
                {lang.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '12px', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                Aucun langage trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
