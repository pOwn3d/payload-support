import { jsx } from 'react/jsx-runtime';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { redirect } from 'next/navigation';
import { AdminErrorBoundary } from '../shared/ErrorBoundary.js';
import { SupportDashboardClient } from './client.js';

const SupportDashboardView = ({ initPageResult }) => {
  const { req, visibleEntities } = initPageResult;
  if (!req.user) {
    redirect("/admin/login");
  }
  return /* @__PURE__ */ jsx(
    DefaultTemplate,
    {
      i18n: req.i18n,
      locale: initPageResult.locale,
      params: {},
      payload: req.payload,
      permissions: initPageResult.permissions,
      searchParams: {},
      user: req.user,
      visibleEntities,
      children: /* @__PURE__ */ jsx(AdminErrorBoundary, { viewName: "SupportDashboardView", children: /* @__PURE__ */ jsx(SupportDashboardClient, {}) })
    }
  );
};
var SupportDashboardView_default = SupportDashboardView;

export { SupportDashboardView, SupportDashboardView_default as default };
