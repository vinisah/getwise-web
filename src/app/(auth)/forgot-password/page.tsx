"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setDone(true); // resposta sempre genérica (anti-enumeração)
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div className="gw-card" style={{ width: "100%", maxWidth: 420, padding: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <Logo variant="icon" height={48} />
        </div>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={32} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Link enviado</h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}>
              Se o e-mail existir, você receberá um link para redefinir a senha.
            </p>
            <Link href="/login"><Button variant="outline" style={{ marginTop: 22, width: "100%" }}>Voltar ao login</Button></Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", textAlign: "center" }}>Esqueceu a senha?</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", marginTop: 5 }}>Enviaremos um link de redefinição</p>
            <form onSubmit={handleSubmit} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="gw-field">
                <span className="gw-field-label">E-mail</span>
                <div className="gw-field-box">
                  <Mail size={18} color="var(--muted)" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
                </div>
              </label>
              <Button type="submit" variant="accent" disabled={loading} style={{ width: "100%", padding: 13 }}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
            <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "var(--accent)", fontWeight: 600, textDecoration: "none", marginTop: 20 }}>
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
