"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erro ao redefinir senha.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--danger)" }}>Token ausente ou inválido.</p>
        <Link href="/forgot-password"><Button variant="outline" style={{ marginTop: 16 }}>Pedir novo link</Button></Link>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={32} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Senha redefinida</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>Redirecionando ao login...</p>
      </div>
    );
  }

  return (
    <>
      <h2 style={{ fontSize: 21, fontWeight: 800, color: "var(--ink)", textAlign: "center" }}>Nova senha</h2>
      <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", marginTop: 5 }}>Escolha uma senha forte</p>
      <form onSubmit={handleSubmit} style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="gw-field">
          <span className="gw-field-label">Senha</span>
          <div className="gw-field-box">
            <Lock size={18} color="var(--muted)" />
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
            <button type="button" className="gw-eye" onClick={() => setShow(!show)}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        {error && <p style={{ fontSize: 13, color: "var(--danger)", textAlign: "center" }}>{error}</p>}
        <Button type="submit" variant="accent" disabled={loading} style={{ width: "100%", padding: 13 }}>
          {loading ? "Salvando..." : "Redefinir senha"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div className="gw-card" style={{ width: "100%", maxWidth: 420, padding: 36 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <Logo variant="icon" height={48} />
        </div>
        <Suspense fallback={<p style={{ textAlign: "center", color: "var(--muted)" }}>Carregando...</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
