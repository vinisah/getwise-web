"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erro ao criar conta.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="gw-login">
      <div className="gw-login-brand">
        <div style={{ position: "relative", zIndex: 2 }}>
          <Logo variant="icon" white height={48} />
        </div>
        <div className="gw-login-brand-mid">
          <h1 style={{ fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: "-.03em", lineHeight: 1.1, marginTop: 16 }}>
            Comece sua jornada
            <br />
            <span style={{ color: "#9FB4FF" }}>rumo à fluência.</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.7)", marginTop: 18, maxWidth: 380, lineHeight: 1.55 }}>
            Cursos por nível (A1–C2), trilha de aprendizado, tutor de IA e certificados.
          </p>
        </div>
        <div className="gw-login-orb" />
        <div className="gw-login-orb two" />
      </div>

      <div className="gw-login-form-wrap">
        <div className="gw-login-form">
          {done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <CheckCircle size={34} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Confira seu e-mail</h2>
              <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}>
                Enviamos um link de confirmação para <b>{email}</b>. Clique nele para ativar sua conta.
              </p>
              <Link href="/login">
                <Button variant="outline" style={{ marginTop: 24, width: "100%" }}>Voltar ao login</Button>
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
                <Logo variant="icon" height={48} />
              </div>
              <h2 style={{ fontSize: 23, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", textAlign: "center" }}>Criar conta</h2>
              <p style={{ fontSize: 13.5, color: "var(--muted)", textAlign: "center", marginTop: 5 }}>Matricule-se na Get Wise</p>

              <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
                <label className="gw-field">
                  <span className="gw-field-label">Nome completo</span>
                  <div className="gw-field-box">
                    <User size={18} color="var(--muted)" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
                  </div>
                </label>
                <label className="gw-field">
                  <span className="gw-field-label">E-mail</span>
                  <div className="gw-field-box">
                    <Mail size={18} color="var(--muted)" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
                  </div>
                </label>
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

                <Button type="submit" variant="accent" disabled={loading} style={{ marginTop: 4, width: "100%", padding: 13 }}>
                  {loading ? "Criando..." : "Criar conta"}
                  {!loading && <ArrowRight size={17} />}
                </Button>
              </form>

              <p style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 22 }}>
                Já tem conta?{" "}
                <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Entrar</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
