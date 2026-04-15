import { jsx } from 'react/jsx-runtime';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { redirect } from 'next/navigation';
import { AdminErrorBoundary } from '../shared/ErrorBoundary.js';
import { LogsClient } from './client.js';

const LogsView = ({ initPageResult }) => {
  const { req, visibleEntities } = initPageResult;
  if (!req.user) redirect("/admin/login");
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
      children: /* @__PURE__ */ jsx(AdminErrorBoundary, { viewName: "LogsView", children: /* @__PURE__ */ jsx(LogsClient, {}) })
    }
  );
};
var LogsView_default = LogsView;

export { LogsView, LogsView_default as default };
