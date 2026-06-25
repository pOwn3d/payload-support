import PDFDocument from 'pdfkit'

export interface InvoiceLine {
  ticketNumber: string
  subject: string
  client: string
  minutes: number
  amount: number
}

export interface InvoiceData {
  from: string
  to: string
  projectId?: string | null
  lines: InvoiceLine[]
  totalMinutes: number
  totalAmount: number
}

const fmtAmount = (n: number) => `${n.toFixed(2)} EUR`
const fmtTime = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`

/**
 * Render a real (binary) PDF invoice from billing data, using pdfkit. Returns the
 * complete PDF as a Buffer (suitable for an HTTP `application/pdf` response).
 */
export function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fillColor('#0f172a').fontSize(22).text('Invoice / Pre-billing')
      doc.moveDown(0.2)
      doc.fillColor('#64748b').fontSize(10)
        .text(`Period: ${data.from} -> ${data.to}${data.projectId ? `   ·   Project #${data.projectId}` : ''}`)
      doc.moveDown(1)

      // Column layout (x positions)
      const X = { ticket: 50, subject: 130, client: 320, time: 430, amount: 500 }
      const drawRow = (r: { ticket: string; subject: string; client: string; time: string; amount: string }, opts?: { header?: boolean; total?: boolean }) => {
        const y = doc.y
        doc.fontSize(opts?.header ? 9 : 10).fillColor(opts?.header ? '#475569' : '#0f172a')
        if (opts?.total) doc.font('Helvetica-Bold')
        doc.text(r.ticket, X.ticket, y, { width: X.subject - X.ticket - 6 })
        doc.text(r.subject, X.subject, y, { width: X.client - X.subject - 6 })
        doc.text(r.client, X.client, y, { width: X.time - X.client - 6 })
        doc.text(r.time, X.time, y, { width: X.amount - X.time - 6, align: 'right' })
        doc.text(r.amount, X.amount, y, { width: 545 - X.amount, align: 'right' })
        doc.font('Helvetica')
        doc.moveDown(0.4)
      }

      drawRow({ ticket: 'Ticket', subject: 'Subject', client: 'Client', time: 'Time', amount: 'Amount' }, { header: true })
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke()
      doc.moveDown(0.3)

      for (const l of data.lines) {
        if (doc.y > 760) doc.addPage()
        drawRow({
          ticket: l.ticketNumber || '',
          subject: l.subject || '',
          client: l.client || '',
          time: fmtTime(l.minutes),
          amount: fmtAmount(l.amount),
        })
      }

      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#0f172a').stroke()
      doc.moveDown(0.3)
      drawRow({
        ticket: '',
        subject: `Total (${data.lines.length} ticket${data.lines.length > 1 ? 's' : ''})`,
        client: '',
        time: fmtTime(data.totalMinutes),
        amount: fmtAmount(data.totalAmount),
      }, { total: true })

      doc.end()
    } catch (err) {
      reject(err as Error)
    }
  })
}
