import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import { supportViewRedirectTarget } from '../shared/viewAccess.js'
import React from 'react'
import { AdminErrorBoundary } from '../shared/ErrorBoundary'
import { TicketingSettingsClient } from './client'

export const TicketingSettingsView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const { req, visibleEntities } = initPageResult

  const redirectTo = supportViewRedirectTarget(initPageResult)
  if (redirectTo) redirect(redirectTo)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={{}}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={{}}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <AdminErrorBoundary viewName="TicketingSettingsView">
        <TicketingSettingsClient />
      </AdminErrorBoundary>
    </DefaultTemplate>
  )
}

export default TicketingSettingsView
