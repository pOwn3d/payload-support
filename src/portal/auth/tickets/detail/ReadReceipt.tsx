'use client'

const TZ = 'Europe/Paris'

export function ReadReceipt({
  lastAdminReadAt,
  messageCreatedAt,
}: {
  lastAdminReadAt?: string | null
  messageCreatedAt: string
}) {
  if (!lastAdminReadAt) return null

  const readTime = new Date(lastAdminReadAt).getTime()
  const msgTime = new Date(messageCreatedAt).getTime()

  // Only show "Lu" if the admin read after this message was created
  if (readTime < msgTime) return null

  const readDate = new Date(lastAdminReadAt)
  const formatted = readDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })

  return (
    <div className="mt-1 text-right">
      <span className="text-[10px] text-blue-400 dark:text-blue-500 font-medium">
        Lu {formatted}
      </span>
    </div>
  )
}
