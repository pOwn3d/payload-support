import { jsx } from 'react/jsx-runtime';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { redirect } from 'next/navigation';
import { AdminErrorBoundary } from '../shared/ErrorBoundary.js';
import { TicketingSettingsClient } from './client.js';

const TicketingSettingsView = ({ initPageResult }) => {
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
      children: /* @__PURE__ */ jsx(AdminErrorBoundary, { viewName: "TicketingSettingsView", children: /* @__PURE__ */ jsx(TicketingSettingsClient, {}) })
    }
  );
};
var TicketingSettingsView_default = TicketingSettingsView;

export { TicketingSettingsView, TicketingSettingsView_default as default };
