import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import React from 'react'
import { AdminErrorBoundary } from '../shared/ErrorBoundary'
import { SupportDashboardClient } from './client'

export const SupportDashboardView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
  const { req, visibleEntities } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={{}}
      payload={req.payload}
      permissions={initPageResult.permissions}
      searchParams={{}}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <AdminErrorBoundary viewName="SupportDashboardView">
        <SupportDashboardClient />
      </AdminErrorBoundary>
    </DefaultTemplate>
  )
}

export default SupportDashboardView
