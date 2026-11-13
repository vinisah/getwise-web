"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import styles from "./preferences.module.css";

/** An app-owned dialog for links; the browser owns actual document-unload prompts. */
export function UnsavedPreferences({ dirty }: { dirty: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const leaving = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!leaving.current) event.preventDefault();
    };
    const onLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === location.href)
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(anchor.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (destination) dialog.current?.showModal();
  }, [destination]);
  function stay() {
    dialog.current?.close();
    setDestination(null);
  }
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="unsaved-title" onCancel={stay}>
      <h2 id="unsaved-title">Sair sem salvar?</h2>
      <p>
        Suas escolhas ainda não foram salvas. Você pode continuar editando ou sair e manter as preferências anteriores.
      </p>
      <div className={styles.actions}>
        <Button type="button" onClick={stay} autoFocus>
          Continuar editando
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (destination) {
              leaving.current = true;
              location.assign(destination);
            }
          }}
        >
          Sair sem salvar
        </Button>
      </div>
    </dialog>
  );
}
