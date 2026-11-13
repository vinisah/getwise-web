"use client";

import { createContext, useContext, useEffect, useState } from "react";

type MobileNav = { open: boolean; setOpen: (v: boolean) => void };

const MobileNavContext = createContext<MobileNav>({ open: false, setOpen: () => {} });

/** Estado compartilhado do drawer de navegação mobile (hambúrguer ↔ sidebar). */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () =>
      document.documentElement.style.setProperty("--gw-visible-height", `${viewport?.height ?? window.innerHeight}px`);
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--gw-visible-height");
    };
  }, []);
  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

export const useMobileNav = () => useContext(MobileNavContext);
