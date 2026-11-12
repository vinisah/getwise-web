"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Atualiza a agenda aberta do professor após respostas feitas em outra sessão. */
export function AgendaRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !pending) startTransition(() => router.refresh());
    };
    const interval = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router, pending]);
  return (
    <button className="gw-btn" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Atualizando…" : "Atualizar agenda"}
    </button>
  );
}
