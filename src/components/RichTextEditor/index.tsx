'use client'

import React, { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from 'react'

export interface RichTextEditorHandle {
  clear: () => void
  setContent: (html: string) => void
  getHtml: () => string
  getPlainText: () => string
  focus: () => void
}

interface Props {
  initialValue?: string
  onChange: (html: string, plainText: string) => void
  placeholder?: string
  minHeight?: number
  onFileUpload?: (file: File) => Promise<string | null>
  borderColor?: string
  focusBorderColor?: string
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  {
    initialValue = '',
    onChange,
    placeholder = 'Écrivez votre message...',
    minHeight = 150,
    onFileUpload,
    borderColor = '#000',
    focusBorderColor = '#00E5FF',
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialValue)

  // Set initial content via ref (avoids React reconciliation issues with contentEditable)
  useEffect(() => {
    if (editorRef.current && initialValue) {
      editorRef.current.innerHTML = initialValue
      const text = editorRef.current.innerText?.trim() || ''
      setIsEmpty(!text && !editorRef.current.querySelector('img'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emitChange = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const text = editorRef.current.innerText?.trim() || ''
    const empty = !text && !editorRef.current.querySelector('img')
    setIsEmpty(empty)
    onChange(empty ? '' : html, text)
  }, [onChange])

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    setTimeout(emitChange, 0)
  }, [emitChange])

  useImperativeHandle(ref, () => ({
    clear: () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
        setIsEmpty(true)
        onChange('', '')
      }
    },
    setContent: (html: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html
        const text = editorRef.current.innerText?.trim() || ''
        setIsEmpty(!text && !editorRef.current.querySelector('img'))
        onChange(html, text)
      }
    },
    getHtml: () => editorRef.current?.innerHTML || '',
    getPlainText: () => editorRef.current?.innerText?.trim() || '',
    focus: () => editorRef.current?.focus(),
  }))

  const handleInsertLink = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      const url = prompt('URL du lien :')
      if (!url) return
      const text = prompt('Texte du lien :', url) || url
      const safeUrl = url.replace(/"/g, '&quot;')
      const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      document.execCommand('insertHTML', false, `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`)
      editorRef.current?.focus()
      setTimeout(emitChange, 0)
    } else {
      const url = prompt('URL du lien :')
      if (url) exec('createLink', url)
    }
  }, [exec, emitChange])

  const handleImageClick = useCallback(() => {
    if (onFileUpload) {
      fileInputRef.current?.click()
    } else {
      const url = prompt('URL de l\'image :')
      if (url) {
        const safeUrl = url.replace(/"/g, '&quot;')
        document.execCommand('insertHTML', false, `<img src="${safeUrl}" alt="Image" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`)
        editorRef.current?.focus()
        setTimeout(emitChange, 0)
      }
    }
  }, [onFileUpload, emitChange])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !onFileUpload) return
    for (const file of Array.from(e.target.files)) {
      if (!file.type.startsWith('image/')) continue
      const url = await onFileUpload(file)
      if (url) {
        const safeName = file.name.replace(/"/g, '&quot;')
        document.execCommand('insertHTML', false, `<img src="${url}" alt="${safeName}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`)
        editorRef.current?.focus()
        setTimeout(emitChange, 0)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onFileUpload, emitChange])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!onFileUpload) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const url = await onFileUpload(file)
          if (url) {
            document.execCommand('insertHTML', false, `<img src="${url}" alt="Image collée" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`)
            editorRef.current?.focus()
            setTimeout(emitChange, 0)
          }
        }
        return
      }
    }
  }, [onFileUpload, emitChange])

  const btn: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: '8px 10px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#555',
    borderRadius: '5px',
    lineHeight: 1,
    minHeight: '44px',
    minWidth: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const sep: React.CSSProperties = {
    width: '1px',
    height: '18px',
    background: '#d1d5db',
    margin: '0 4px',
    alignSelf: 'center',
  }

  return (
    <div style={{ border: `3px solid ${focused ? focusBorderColor : borderColor}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s', background: '#fff' }}>
      <style>{`
        .rte-toolbar button:hover { background: #e5e7eb !important; }
        .rte-editor blockquote { border-left: 4px solid #00E5FF; margin: 8px 0; padding: 8px 16px; background: #f0f9ff; border-radius: 0 6px 6px 0; }
        .rte-editor img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; }
        .rte-editor a { color: #00838f; text-decoration: underline; }
        .rte-editor ul, .rte-editor ol { margin: 8px 0; padding-left: 24px; }
        .rte-editor li { margin: 2px 0; }
        .rte-editor p { margin: 0 0 6px 0; }
      `}</style>

      {/* Toolbar */}
      <div className="rte-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 10px', borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb', flexWrap: 'wrap' }}>
        <button type="button" style={btn} onMouseDown={(e) => { e.preventDefault(); exec('bold') }} title="Gras (Ctrl+B)">
          <strong>B</strong>
        </button>
        <button type="button" style={btn} onMouseDown={(e) => { e.preventDefault(); exec('italic') }} title="Italique (Ctrl+I)">
          <em style={{ fontStyle: 'italic' }}>I</em>
        </button>
        <button type="button" style={btn} onMouseDown={(e) => { e.preventDefault(); exec('underline') }} title="Souligné (Ctrl+U)">
          <span style={{ textDecoration: 'underline' }}>S</span>
        </button>
        <span style={sep} />
        <button type="button" style={{ ...btn, fontSize: '16px' }} onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'blockquote') }} title="Citation">
          &ldquo;&rdquo;
        </button>
        <button type="button" style={{ ...btn, fontSize: '12px' }} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList') }} title="Liste à puces">
          &bull; Liste
        </button>
        <button type="button" style={{ ...btn, fontSize: '12px' }} onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList') }} title="Liste numérotée">
          1. Liste
        </button>
        <span style={sep} />
        <button type="button" style={btn} onMouseDown={(e) => { e.preventDefault(); handleInsertLink() }} title="Insérer un lien">
          &#128279;
        </button>
        <button type="button" style={btn} onMouseDown={(e) => { e.preventDefault(); handleImageClick() }} title="Insérer une image">
          &#128444;&#65039;
        </button>
      </div>

      {/* Editor area */}
      <div style={{ position: 'relative' }}>
        {isEmpty && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 16px', color: '#9ca3af', fontSize: '14px', pointerEvents: 'none', userSelect: 'none' }}>
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          className="rte-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); emitChange() }}
          onPaste={handlePaste}
          style={{
            minHeight: `${minHeight}px`,
            padding: '14px 16px',
            fontSize: '14px',
            lineHeight: 1.6,
            color: '#1f2937',
            outline: 'none',
            overflowY: 'auto',
          }}
        />
      </div>

      {/* Hidden file input for image upload */}
      {onFileUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      )}
    </div>
  )
})
