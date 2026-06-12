"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[GLOBAL ERROR]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#F2F4FB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", padding: 32 }}>
          <h1 style={{ fontSize: 24, color: "#131A38", fontWeight: 800 }}>
            Erro crítico
          </h1>
          <p style={{ color: "#8A93B5", marginTop: 8 }}>
            {process.env.NODE_ENV === "development"
              ? error.message
              : "Recarregue a página."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "11px 24px",
              background: "#2A5CD6",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
