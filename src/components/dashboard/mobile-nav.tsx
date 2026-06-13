"use client";

import { createContext, useContext, useState } from "react";

type MobileNav = { open: boolean; setOpen: (v: boolean) => void };

const MobileNavContext = createContext<MobileNav>({ open: false, setOpen: () => {} });

/** Estado compartilhado do drawer de navegação mobile (hambúrguer ↔ sidebar). */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

export const useMobileNav = () => useContext(MobileNavContext);
