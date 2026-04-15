'use strict';

var react = require('react');

const TicketContext = react.createContext(null);
function useTicketContext() {
  const ctx = react.useContext(TicketContext);
  if (!ctx) throw new Error("useTicketContext must be used within TicketContext.Provider");
  return ctx;
}

exports.TicketContext = TicketContext;
exports.useTicketContext = useTicketContext;
