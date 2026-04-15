'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import styles from '../../styles/ImportConversation.module.scss'

interface PreviewMessage {
  from: 'client' | 'admin'
  name: string
  date: string
  preview: string
}

interface PreviewData {
  client: { email: string; name: string; company: string }
  subject: string
  messageCount: number
  messages: PreviewMessage[]
  parseMethod: string
}

interface ImportResult {
  ticketNumber: string
  ticketId: number
  clientEmail: string
  clientName: string
  clientCompany: string
  isNewClient: boolean
  messagesImported: number
}

export function ImportConversationClient() {
  const { t } = useTranslation()
  const [markdown, setMarkdown] = useState('')
  const [fileName, setFileName] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      setError(t('import.formatError'))
      return
    }
    if (file.size > 512_000) {
      setError(t('import.sizeError'))
      return
    }

    setError('')
    setFileName(file.name)
    setResult(null)
    setPreview(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setMarkdown(content)
    }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const doPreview = useCallback(async () => {
    if (!markdown) return
    setLoading(true)
    setError('')
    setPreview(null)

    try {
      const res = await fetch('/api/support/import-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, previewOnly: true }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'analyse')
        return
      }

      setPreview(data)
    } catch {
      setError('Erreur reseau')
    } finally {
      setLoading(false)
    }
  }, [markdown])

  const doImport = useCallback(async () => {
    if (!markdown) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/support/import-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'import')
        return
      }

      setResult(data)
      setPreview(null)
    } catch {
      setError('Erreur reseau')
    } finally {
      setLoading(false)
    }
  }, [markdown])

  const reset = useCallback(() => {
    setMarkdown('')
    setFileName('')
    setPreview(null)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const dropzoneClass = isDragOver
    ? styles.dropzoneDragOver
    : markdown
      ? styles.dropzoneHasFile
      : styles.dropzone

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('import.title')}</h1>
        </div>
        {result && (
          <button onClick={reset} className={styles.btnPrimary}>
            {t('import.newImport')}
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          className={dropzoneClass}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className={styles.dropzoneIcon}>&#8593;</div>
          <p className={styles.dropzoneText}>
            {markdown
              ? t('import.dropzoneLoaded')
              : t('import.dropzoneText')}
          </p>
          {!markdown && (
            <p style={{ fontSize: 12, color: 'var(--theme-elevation-400)', marginTop: 8 }}>
              {t('import.acceptedFormats')}
            </p>
          )}
          {fileName && <p className={styles.fileName}>{fileName}</p>}
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.resultError}>
          <div className={styles.resultTitleError}>
            &#9888; Erreur
          </div>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {/* Actions */}
      {markdown && !preview && !result && (
        <div className={styles.btnRow}>
          <button onClick={doPreview} disabled={loading} className={styles.btnAmber}>
            <span className={styles.btnContent}>
              &#128065; {loading ? t('import.analyzing') : t('import.preview')}
            </span>
          </button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              &#128100; {t('import.client')}
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('import.name')}</span>
              <span className={styles.infoValue}>{preview.client.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('import.email')}</span>
              <span className={styles.infoValue}>{preview.client.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('import.company')}</span>
              <span className={styles.infoValue}>{preview.client.company}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('import.parsing')}</span>
              <span className={styles.infoValue}>
                <span className={styles.badgeInfo}>
                  {preview.parseMethod === 'structured' ? t('import.parsingRegex') : t('import.parsingAi')}
                </span>
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              &#128172; {preview.subject}
              <span className={styles.sectionTitleRight}>
                {preview.messageCount} {t('import.messages')}
              </span>
            </div>
            {preview.messages.map((msg, i) => (
              <div key={i} className={msg.from === 'admin' ? styles.msgAdmin : styles.msgClient}>
                <div className={styles.msgHeader}>
                  <span className={styles.msgAuthor}>
                    {msg.from === 'admin' ? '>> ' : '<< '}
                    {msg.name}
                  </span>
                  <span className={styles.msgDate}>{msg.date}</span>
                </div>
                <div className={styles.msgPreview}>{msg.preview}</div>
              </div>
            ))}
          </div>

          <div className={styles.btnRow}>
            <button onClick={() => setPreview(null)} className={styles.btnMuted}>
              {t('common.cancel')}
            </button>
            <button onClick={doImport} disabled={loading} className={styles.btnGreen}>
              <span className={styles.btnContent}>
                &#10140; {loading ? t('import.importing') : t('import.importButton', { count: String(preview.messageCount) })}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div className={styles.resultSuccess}>
          <div className={styles.resultTitleSuccess}>
            &#10003; {t('import.resultTitle')}
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('import.resultTicket')}</span>
            <span className={styles.infoValue}>
              <a href={`/admin/support/ticket?id=${result.ticketId}`} className={styles.link}>
                {result.ticketNumber}
              </a>
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('import.resultClient')}</span>
            <span className={styles.infoValue}>
              {result.clientName} ({result.clientEmail})
              {result.isNewClient && <span className={styles.badgeNew} style={{ marginLeft: 8 }}>{t('import.resultNew')}</span>}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('import.resultCompany')}</span>
            <span className={styles.infoValue}>{result.clientCompany}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('import.resultMessages')}</span>
            <span className={styles.infoValue}>{t('import.resultImported', { count: String(result.messagesImported) })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
