import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import { supportViewRedirectTarget } from '../shared/viewAccess.js'
import React from 'react'
import { AdminErrorBoundary } from '../shared/ErrorBoundary'
import { BillingClient } from './client'

export const BillingView: React.FC<AdminViewServerProps> = ({ initPageResult }) => {
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
      <AdminErrorBoundary viewName="BillingView">
        <BillingClient />
      </AdminErrorBoundary>
    </DefaultTemplate>
  )
}

export default BillingView
