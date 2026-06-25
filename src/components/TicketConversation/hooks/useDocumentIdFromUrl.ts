import { useState, useEffect } from 'react'

// Replacement for @payloadcms/ui's useDocumentInfo — avoids importing
// @payloadcms/ui (which has chunk splits that break webpack resolution
// when this bundle is consumed from node_modules).
// Extracts the document id from the admin URL pattern:
// /admin/collections/:slug/:id  or  /admin/globals/:slug
export function useDocumentIdFromUrl(): { id: string | number | undefined } {
  const [id, setId] = useState<string | number | undefined>(undefined)
  useEffect(() => {
    const match = window.location.pathname.match(
      /\/admin\/collections\/[^/]+\/([^/?#]+)/
    )
    if (match && match[1] !== 'create') {
      const raw = match[1]
      const num = Number(raw)
      setId(Number.isFinite(num) && String(num) === raw ? num : raw)
    }
  }, [])
  return { id }
}
