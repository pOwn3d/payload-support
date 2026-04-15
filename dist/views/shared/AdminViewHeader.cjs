'use strict';

var jsxRuntime = require('react/jsx-runtime');
var adminTokens = require('./adminTokens');

const AdminViewHeader = ({
  icon,
  title,
  subtitle,
  breadcrumb,
  actions
}) => {
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20
      },
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          breadcrumb && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { marginBottom: 6 }, children: /* @__PURE__ */ jsxRuntime.jsxs(
            "a",
            {
              href: breadcrumb.href,
              style: {
                fontSize: 12,
                fontWeight: 700,
                color: adminTokens.V.cyan,
                textDecoration: "none",
                textTransform: "uppercase"
              },
              children: [
                "\u2190 ",
                breadcrumb.label
              ]
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "h1",
            {
              style: {
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: 0,
                margin: 0,
                color: adminTokens.V.text,
                display: "flex",
                alignItems: "center",
                gap: 10
              },
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { style: { color: adminTokens.V.cyan, display: "flex", alignItems: "center" }, children: icon }),
                title
              ]
            }
          ),
          subtitle && /* @__PURE__ */ jsxRuntime.jsx("p", { style: { color: adminTokens.V.textSecondary, margin: "4px 0 0", fontSize: 14 }, children: subtitle })
        ] }),
        actions && /* @__PURE__ */ jsxRuntime.jsx("div", { style: { display: "flex", gap: 8 }, children: actions })
      ]
    }
  );
};

exports.AdminViewHeader = AdminViewHeader;
