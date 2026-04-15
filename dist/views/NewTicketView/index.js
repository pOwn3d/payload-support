import { jsx } from 'react/jsx-runtime';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { redirect } from 'next/navigation';
import { AdminErrorBoundary } from '../shared/ErrorBoundary.js';
import { NewTicketClient } from './client.js';

const NewTicketView = ({ initPageResult }) => {
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
      children: /* @__PURE__ */ jsx(AdminErrorBoundary, { viewName: "NewTicketView", children: /* @__PURE__ */ jsx(NewTicketClient, {}) })
    }
  );
};
var NewTicketView_default = NewTicketView;

export { NewTicketView, NewTicketView_default as default };
