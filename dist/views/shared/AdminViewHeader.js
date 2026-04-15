"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import { V } from './adminTokens.js';

const AdminViewHeader = ({
  icon,
  title,
  subtitle,
  breadcrumb,
  actions
}) => {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20
      },
      children: [
        /* @__PURE__ */ jsxs("div", { children: [
          breadcrumb && /* @__PURE__ */ jsx("div", { style: { marginBottom: 6 }, children: /* @__PURE__ */ jsxs(
            "a",
            {
              href: breadcrumb.href,
              style: {
                fontSize: 12,
                fontWeight: 700,
                color: V.cyan,
                textDecoration: "none",
                textTransform: "uppercase"
              },
              children: [
                "\u2190 ",
                breadcrumb.label
              ]
            }
          ) }),
          /* @__PURE__ */ jsxs(
            "h1",
            {
              style: {
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: 0,
                margin: 0,
                color: V.text,
                display: "flex",
                alignItems: "center",
                gap: 10
              },
              children: [
                /* @__PURE__ */ jsx("span", { style: { color: V.cyan, display: "flex", alignItems: "center" }, children: icon }),
                title
              ]
            }
          ),
          subtitle && /* @__PURE__ */ jsx("p", { style: { color: V.textSecondary, margin: "4px 0 0", fontSize: 14 }, children: subtitle })
        ] }),
        actions && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8 }, children: actions })
      ]
    }
  );
};

export { AdminViewHeader };
