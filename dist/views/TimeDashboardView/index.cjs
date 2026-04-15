'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var jsxRuntime = require('react/jsx-runtime');
var templates = require('@payloadcms/next/templates');
var navigation = require('next/navigation');
var ErrorBoundary = require('../shared/ErrorBoundary');
var client = require('./client');

const TimeDashboardView = ({ initPageResult }) => {
  const { req, visibleEntities } = initPageResult;
  if (!req.user) {
    navigation.redirect("/admin/login");
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    templates.DefaultTemplate,
    {
      i18n: req.i18n,
      locale: initPageResult.locale,
      params: {},
      payload: req.payload,
      permissions: initPageResult.permissions,
      searchParams: {},
      user: req.user,
      visibleEntities,
      children: /* @__PURE__ */ jsxRuntime.jsx(ErrorBoundary.AdminErrorBoundary, { viewName: "TimeDashboardView", children: /* @__PURE__ */ jsxRuntime.jsx(client.TimeDashboardClient, {}) })
    }
  );
};
var TimeDashboardView_default = TimeDashboardView;

exports.TimeDashboardView = TimeDashboardView;
exports.default = TimeDashboardView_default;
