'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from '../../components/TicketConversation/hooks/useTranslation'
import s from '../../styles/ImportConversation.module.scss'

interface PreviewMessage { from: 'client' | 'admin'; name: string; date: string; preview: string }
interface PreviewData { client: { email: string; name: string; company: string }; subject: string; messageCount: number; messages: PreviewMessage[]; parseMethod: string }
interface ImportResult { ticketNumber: string; ticketId: number; clientEmail: string; clientName: string; clientCompany: string; isNewClient: boolean; messagesImported: number }

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
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) { setError(t('import.formatError')); return }
    if (file.size > 512_000) { setError(t('import.sizeError')); return }
    setError(''); setFileName(file.name); setResult(null); setPreview(null)
    const reader = new FileReader()
    reader.onload = (e) => { setMarkdown(e.target?.result as string) }
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file) }, [handleFile])
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleFile(file) }, [handleFile])

  const doPreview = useCallback(async () => {
    if (!markdown) return; setLoading(true); setError(''); setPreview(null)
    try { const res = await fetch('/api/support/import-conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown, previewOnly: true }) }); const data = await res.json(); if (!res.ok) { setError(data.error || 'Erreur'); return }; setPreview(data) } catch { setError('Erreur reseau') } finally { setLoading(false) }
  }, [markdown])

  const doImport = useCallback(async () => {
    if (!markdown) return; setLoading(true); setError('')
    try { const res = await fetch('/api/support/import-conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown }) }); const data = await res.json(); if (!res.ok) { setError(data.error || 'Erreur'); return }; setResult(data); setPreview(null) } catch { setError('Erreur reseau') } finally { setLoading(false) }
  }, [markdown])

  const reset = useCallback(() => { setMarkdown(''); setFileName(''); setPreview(null); setResult(null); setError(''); if (fileRef.current) fileRef.current.value = '' }, [])

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '20px 30px', maxWidth: 720, margin: '0 auto' },
    dropzone: { border: '2px dashed var(--theme-elevation-300)', borderRadius: 12, padding: 40, textAlign: 'center' as const, cursor: 'pointer', transition: 'all 150ms' },
    dropzoneDragOver: { border: '2px dashed #2563eb', borderRadius: 12, padding: 40, textAlign: 'center' as const, cursor: 'pointer', background: '#eff6ff' },
    dropzoneHasFile: { border: '2px solid #22c55e', borderRadius: 12, padding: 40, textAlign: 'center' as const, cursor: 'pointer', background: '#f0fdf4' },
    btn: { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--theme-elevation-200)', fontSize: 13, cursor: 'pointer', background: 'var(--theme-elevation-0)', color: 'var(--theme-text)', fontWeight: 600 },
    btnPrimary: { padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', background: '#2563eb', color: '#fff', fontWeight: 600 },
    btnGreen: { padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', background: '#16a34a', color: '#fff', fontWeight: 600 },
    btnAmber: { padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, cursor: 'pointer', background: '#d97706', color: '#fff', fontWeight: 600 },
    section: { padding: 16, borderRadius: 10, border: '1px solid var(--theme-elevation-150)', marginBottom: 12 },
    infoRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 },
    infoLabel: { color: 'var(--theme-elevation-500)' },
    infoValue: { fontWeight: 600, color: 'var(--theme-text)' },
    msgAdmin: { padding: '8px 12px', borderRadius: 8, background: '#dbeafe', marginBottom: 6 },
    msgClient: { padding: '8px 12px', borderRadius: 8, background: 'var(--theme-elevation-50)', marginBottom: 6 },
    resultSuccess: { padding: 20, borderRadius: 10, border: '2px solid #22c55e', background: '#f0fdf4' },
    resultError: { padding: 16, borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', marginBottom: 12 },
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('import.title')}</h1>
        {result && <button onClick={reset} style={S.btnPrimary}>{t('import.newImport')}</button>}
      </div>

      {!result && (
        <div style={isDragOver ? S.dropzoneDragOver : markdown ? S.dropzoneHasFile : S.dropzone} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }} onDragLeave={() => setIsDragOver(false)} onDrop={onDrop} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>&#8593;</div>
          <p style={{ fontSize: 14, color: 'var(--theme-text)' }}>{markdown ? t('import.dropzoneLoaded') : t('import.dropzoneText')}</p>
          {!markdown && <p style={{ fontSize: 12, color: 'var(--theme-elevation-400)', marginTop: 8 }}>{t('import.acceptedFormats')}</p>}
          {fileName && <p style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{fileName}</p>}
          <input ref={fileRef} type="file" accept=".md,.txt" onChange={onFileChange} style={{ display: 'none' }} />
        </div>
      )}

      {error && <div style={S.resultError}><strong>{t('common.error')}</strong><p style={{ margin: '4px 0 0' }}>{error}</p></div>}

      {markdown && !preview && !result && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <button onClick={doPreview} disabled={loading} style={S.btnAmber}>{loading ? t('import.analyzing') : t('import.preview')}</button>
        </div>
      )}

      {preview && (
        <>
          <div style={S.section}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('import.client')}</div>
            <div style={S.infoRow}><span style={S.infoLabel}>{t('import.name')}</span><span style={S.infoValue}>{preview.client.name}</span></div>
            <div style={S.infoRow}><span style={S.infoLabel}>{t('import.email')}</span><span style={S.infoValue}>{preview.client.email}</span></div>
            <div style={S.infoRow}><span style={S.infoLabel}>{t('import.company')}</span><span style={S.infoValue}>{preview.client.company}</span></div>
            <div style={S.infoRow}><span style={S.infoLabel}>{t('import.parsing')}</span><span style={S.infoValue}>{preview.parseMethod === 'structured' ? t('import.parsingRegex') : t('import.parsingAi')}</span></div>
          </div>

          <div style={S.section}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>{preview.subject}</span><span style={{ color: 'var(--theme-elevation-500)', fontSize: 12 }}>{preview.messageCount} {t('import.messages')}</span>
            </div>
            {preview.messages.map((msg, i) => (
              <div key={i} style={msg.from === 'admin' ? S.msgAdmin : S.msgClient}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{msg.from === 'admin' ? '>> ' : '<< '}{msg.name}</span>
                  <span style={{ color: 'var(--theme-elevation-400)' }}>{msg.date}</span>
                </div>
                <div style={{ fontSize: 13 }}>{msg.preview}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button onClick={() => setPreview(null)} style={S.btn}>{t('common.cancel')}</button>
            <button onClick={doImport} disabled={loading} style={S.btnGreen}>{loading ? t('import.importing') : t('import.importButton', { count: String(preview.messageCount) })}</button>
          </div>
        </>
      )}

      {result && (
        <div style={S.resultSuccess}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: '#166534' }}>{t('import.resultTitle')}</div>
          <div style={S.infoRow}><span style={S.infoLabel}>{t('import.resultTicket')}</span><span style={S.infoValue}><a href={`/admin/support/ticket?id=${result.ticketId}`} style={{ color: '#2563eb' }}>{result.ticketNumber}</a></span></div>
          <div style={S.infoRow}><span style={S.infoLabel}>{t('import.resultClient')}</span><span style={S.infoValue}>{result.clientName} ({result.clientEmail}){result.isNewClient && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: '#dbeafe', color: '#1e40af', fontSize: 10 }}>{t('import.resultNew')}</span>}</span></div>
          <div style={S.infoRow}><span style={S.infoLabel}>{t('import.resultCompany')}</span><span style={S.infoValue}>{result.clientCompany}</span></div>
          <div style={S.infoRow}><span style={S.infoLabel}>{t('import.resultMessages')}</span><span style={S.infoValue}>{t('import.resultImported', { count: String(result.messagesImported) })}</span></div>
        </div>
      )}
    </div>
  )
}
