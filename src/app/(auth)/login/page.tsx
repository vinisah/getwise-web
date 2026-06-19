"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/gw/logo";
import { Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Check, Globe, ArrowRight } from "lucide-react";

const VERIFY_MSG: Record<string, { text: string; ok: boolean }> = {
  success: { text: "E-mail confirmado! Faça login.", ok: true },
  expired: { text: "Link de confirmação expirado. Cadastre-se novamente.", ok: false },
  invalid: { text: "Link de confirmação inválido.", ok: false },
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const verify = params.get("verify");
  const verifyMsg = verify ? VERIFY_MSG[verify] : null;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login passwordless (demo): entra direto como ADMIN, sem credenciais.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", { redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Não foi possível entrar. Tente novamente.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="gw-login">
      {/* Painel brand esquerdo */}
      <div className="gw-login-brand">
        <div style={{ position: "relative", zIndex: 2 }}>
          <Logo variant="icon" white height={48} />
        </div>

        <div className="gw-login-brand-mid">
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.6)",
            }}
          >
            Sistema de gestão · Idiomas
          </span>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-.03em",
              lineHeight: 1.08,
              marginTop: 16,
            }}
          >
            Ensine, acompanhe
            <br />
            e faça seus alunos
            <br />
            <span style={{ color: "#9FB4FF" }}>falarem inglês.</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.7)", marginTop: 18, maxWidth: 380, lineHeight: 1.55 }}>
            Matrículas, aulas, financeiro e um tutor de IA — tudo em um só lugar, com a cara da Get Wise.
          </p>
          <div className="gw-login-pills">
            {["Gestão de alunos", "Financeiro", "Tutor IA", "Relatórios"].map((p) => (
              <span key={p} className="gw-login-pill">
                <Check size={14} strokeWidth={2.4} />
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="gw-login-brand-foot">
          <Avatar initials="MA" size={34} tone="seed" />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.78)", lineHeight: 1.5, margin: 0 }}>
            "Reduzi pela metade o tempo gasto com a secretaria." <b style={{ color: "#fff" }}>— Marina, coordenadora</b>
          </p>
        </div>

        <div className="gw-login-orb" />
        <div className="gw-login-orb two" />
      </div>

      {/* Form direito */}
      <div className="gw-login-form-wrap">
        <div className="gw-login-form">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
            <Logo variant="icon" height={52} />
          </div>
          <h2
            style={{ fontSize: 23, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", textAlign: "center" }}
          >
            Bem-vindo de volta
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", marginTop: 5 }}>
            Acesse o portal Get Wise
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              Acesso de demonstração — você entra como administrador, sem senha.
            </p>

            {verifyMsg && (
              <p
                style={{ fontSize: 13, color: verifyMsg.ok ? "var(--success)" : "var(--danger)", textAlign: "center" }}
              >
                {verifyMsg.text}
              </p>
            )}
            {error && <p style={{ fontSize: 13, color: "var(--danger)", textAlign: "center" }}>{error}</p>}

            <Button
              type="submit"
              variant="accent"
              disabled={loading}
              style={{ marginTop: 4, width: "100%", padding: 13 }}
            >
              {loading ? "Entrando..." : "Entrar no portal"}
              {!loading && <ArrowRight size={17} />}
            </Button>
          </form>

          <div className="gw-login-or">
            <span>ou</span>
          </div>
          <button type="button" className="gw-sso">
            <Globe size={18} />
            Entrar com Google Workspace
          </button>

          <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 22 }}>
            Novo na escola?{" "}
            <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
              Fazer matrícula online
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
      <LoginInner />
    </Suspense>
  );
}
