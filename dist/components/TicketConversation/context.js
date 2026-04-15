"use client";
import { createContext, useContext } from 'react';

const TicketContext = createContext(null);
function useTicketContext() {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTicketContext must be used within TicketContext.Provider");
  return ctx;
}

export { TicketContext, useTicketContext };
