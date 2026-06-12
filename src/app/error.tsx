"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Fail loud: loga no cliente para debugging (não expõe ao usuário final)
    console.error("[PAGE ERROR]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "var(--pad)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "var(--r-sm)",
          background: "var(--danger-soft)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        !
      </div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: "-.01em",
        }}
      >
        Algo deu errado
      </h2>
      <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", maxWidth: 360 }}>
        {process.env.NODE_ENV === "development"
          ? error.message
          : "Ocorreu um erro inesperado. Tente novamente."}
      </p>
      <Button variant="accent" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
