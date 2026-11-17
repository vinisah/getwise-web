"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, fetchJson } from "@/components/enrollment/fields";
import s from "@/components/enrollment/enrollment.module.css";
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/auth/local-preview", { signal: ctrl.signal })
      .then((r) => setDemo(r.enabled))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  async function enter(localDemo = false) {
    if (busy) return;
    if (!localDemo && (!email || !password)) {
      setError("Informe seu e-mail e senha.");
      document.getElementById(!email ? "email" : "password")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await signIn("credentials", { email, password, demo: localDemo ? "1" : "0", redirect: false });
      if (r?.error) {
        setError("Não foi possível entrar. Confira seu e-mail e senha.");
        return;
      }
      const destination = params.get("callbackUrl");
      router.push(destination?.startsWith("/") && !destination.startsWith("//") ? destination : "/");
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="gw-login">
      <aside className="gw-login-brand">
        <Logo variant="icon" white height={48} />
        <div className="gw-login-brand-mid">
          <p style={{ color: "#ffffffb8", letterSpacing: ".12em", fontSize: 11 }}>GET WISE · SPEAK ENGLISH</p>
          <h1 style={{ color: "white", fontSize: 44, fontWeight: 800, lineHeight: 1.12, marginTop: 20 }}>
            Um novo idioma.
            <br />
            Mais possibilidades.
          </h1>
          <p style={{ color: "#ffffffb8", maxWidth: 370, marginTop: 24, lineHeight: 1.7 }}>
            Seu espaço para aprender, acompanhar as aulas e se conectar com a Get Wise.
          </p>
        </div>
        <p style={{ color: "#ffffffb8" }}>Uma etapa de cada vez. A gente segue com você.</p>
      </aside>
      <section className="gw-login-form-wrap">
        <div className="gw-login-form">
          <Logo variant="icon" height={48} />
          <h2 style={{ fontSize: 28, fontWeight: 800, marginTop: 24 }}>Bem-vindo de volta</h2>
          <p className={s.muted}>Entre para estudar ou acompanhar sua pré-matrícula.</p>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void enter();
            }}
            className={s.stack}
            style={{ marginTop: 28 }}
          >
            <Field name="email" label="E-mail" value={email} onChange={setEmail} type="email" autoComplete="username" />
            <PasswordField value={password} onChange={setPassword} />
            <Link href="/forgot-password" className={s.link}>
              Esqueci minha senha
            </Link>
            {params.get("verify") && (
              <p role="status" className={s.notice}>
                {params.get("verify") === "success"
                  ? "E-mail confirmado. Você já pode entrar."
                  : "O link não pôde ser confirmado. Entre na sua conta e solicite um novo envio no acompanhamento."}
              </p>
            )}
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
            <Button disabled={busy} type="submit">
              {busy ? "Entrando…" : "Entrar no portal"}
            </Button>
          </form>
          <p className={s.muted} style={{ marginTop: 28 }}>
            Novo na escola?{" "}
            <Link className={s.link} href="/register">
              Fazer matrícula online
            </Link>
          </p>
          {demo && (
            <div className={s.notice}>
              <p>Avaliação local</p>
              <Button disabled={busy} variant="outline" onClick={() => enter(true)}>
                Abrir painel administrativo
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Carregando acesso…</p>}>
      <Login />
    </Suspense>
  );
}
