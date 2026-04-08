'use client'

import React, { useState } from 'react'

interface CollapsibleMessagesProps {
  children: React.ReactNode[]
}

const VISIBLE_COUNT = 3

export const CollapsibleMessages: React.FC<CollapsibleMessagesProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(true)

  if (!children || children.length <= VISIBLE_COUNT) {
    return <>{children}</>
  }

  const hiddenCount = children.length - VISIBLE_COUNT
  const lastMessages = children.slice(-VISIBLE_COUNT)

  if (collapsed) {
    return (
      <>
        <button
          onClick={() => setCollapsed(false)}
          className="no-print w-full rounded-2xl border-2 border-dashed border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
        >
          Voir les {hiddenCount} message{hiddenCount > 1 ? 's' : ''} précédent{hiddenCount > 1 ? 's' : ''}
        </button>
        {lastMessages}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setCollapsed(true)}
        className="no-print w-full rounded-2xl border-2 border-dashed border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
      >
        Masquer les anciens messages
      </button>
      {children}
    </>
  )
}
