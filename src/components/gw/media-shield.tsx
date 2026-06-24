"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Escudo anticópia para conteúdo de vídeo. DISSUASORES (não bloqueio absoluto — gravação de
 * tela/print no nível do SISTEMA OPERACIONAL ou celular filmando NÃO dá pra impedir num
 * navegador). O que faz: marca d'água MÓVEL com o identificador do aluno (vazou → rastreável),
 * BORRA o conteúdo quando a aba perde o foco (atrapalha gravação em 2ª tela/janela), bloqueia
 * clique-direito/seleção/arrastar e intercepta teclas óbvias (Ctrl/Cmd+P/S, PrintScreen).
 */
export function MediaShield({
  label,
  children,
  onObscureChange,
}: {
  label: string;
  children: React.ReactNode;
  onObscureChange?: (obscured: boolean) => void;
}) {
  const [pos, setPos] = useState({ top: 12, left: 12 });
  const [obscured, setObscured] = useState(false);
  const [warn, setWarn] = useState(false);
  const warnT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback via ref: o efeito de foco abaixo não deve re-subscrever os listeners a cada render
  // do pai (video-player re-renderiza ~várias vezes/seg durante o playback c/ callback inline).
  const onObscureRef = useRef(onObscureChange);
  useEffect(() => {
    onObscureRef.current = onObscureChange;
  });

  // Marca d'água anda pela tela a cada ~4s (defeita crop fixo). Só no cliente (evita mismatch SSR).
  useEffect(() => {
    const id = setInterval(() => {
      setPos({ top: 8 + Math.floor(Math.random() * 78), left: 6 + Math.floor(Math.random() * 70) });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Borra ao perder foco / trocar de aba (atrapalha gravar numa 2ª janela visível).
  useEffect(() => {
    const onHide = () => {
      const hidden = document.visibilityState === "hidden" || !document.hasFocus();
      setObscured(hidden);
      onObscureRef.current?.(hidden);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onHide);
    };
  }, []);

  function flashWarn() {
    setWarn(true);
    if (warnT.current) clearTimeout(warnT.current);
    warnT.current = setTimeout(() => setWarn(false), 1600);
  }

  // Intercepta teclas óbvias de captura/print (best-effort — não pega combos de SO tipo Win+Shift+S).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s")) {
        e.preventDefault();
        flashWarn();
      } else if (k === "printscreen") {
        navigator.clipboard?.writeText?.(" ").catch(() => {});
        flashWarn();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => {
        e.preventDefault();
        flashWarn();
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}

      {/* Marca d'água móvel (não captura clique). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: `${pos.top}%`,
          left: `${pos.left}%`,
          pointerEvents: "none",
          color: "rgba(255,255,255,.32)",
          fontSize: 12,
          fontWeight: 700,
          textShadow: "0 1px 2px rgba(0,0,0,.6)",
          transition: "top .8s ease, left .8s ease",
          zIndex: 3,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      {/* Borra ao sair do foco. */}
      {obscured && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            background: "rgba(16,22,48,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            padding: 16,
          }}
        >
          Conteúdo protegido — volte para a aba para continuar assistindo.
        </div>
      )}

      {/* Aviso transitório de tentativa de cópia. */}
      {warn && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 5,
            background: "rgba(210,56,43,.92)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 10px",
            borderRadius: 8,
            pointerEvents: "none",
          }}
        >
          Conteúdo protegido contra cópia
        </div>
      )}
    </div>
  );
}
