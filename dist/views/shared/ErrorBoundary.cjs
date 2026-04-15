'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

class AdminErrorBoundary extends React__default.default.Component {
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
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: {
        padding: "40px",
        textAlign: "center",
        color: "#dc2626"
      }, children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { marginBottom: "16px", fontSize: "18px" }, children: "Une erreur est survenue" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { style: { marginBottom: "24px", color: "#6b7280", fontSize: "14px" }, children: this.state.error?.message || "Erreur inattendue" }),
        /* @__PURE__ */ jsxRuntime.jsx(
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

exports.AdminErrorBoundary = AdminErrorBoundary;
