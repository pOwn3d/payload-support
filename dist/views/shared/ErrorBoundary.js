"use client";
import { jsxs, jsx } from 'react/jsx-runtime';
import React from 'react';

class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error(`[${this.props.viewName || "AdminView"}] Error:`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return /* @__PURE__ */ jsxs("div", { style: {
        padding: "40px",
        textAlign: "center",
        color: "#dc2626"
      }, children: [
        /* @__PURE__ */ jsx("h2", { style: { marginBottom: "16px", fontSize: "18px" }, children: "Une erreur est survenue" }),
        /* @__PURE__ */ jsx("p", { style: { marginBottom: "24px", color: "#6b7280", fontSize: "14px" }, children: this.state.error?.message || "Erreur inattendue" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => this.setState({ hasError: false, error: null }),
            style: {
              padding: "8px 20px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            },
            children: "Reessayer"
          }
        )
      ] });
    }
    return this.props.children;
  }
}

export { AdminErrorBoundary };
