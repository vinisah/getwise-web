"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AccessShell } from "@/components/enrollment/access-shell";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, fetchJson } from "@/components/enrollment/fields";
import { ArrowRight, ArrowUpRight, ClipboardCheck, Mail } from "lucide-react";
import { isPreEnrollmentAccess, loginDestination, PRE_ENROLLMENT_LOGIN } from "@/lib/pre-enrollment/access";
import s from "./login.module.css";

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const tracking = isPreEnrollmentAccess(params.get("mode"), params.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/auth/local-preview", { signal: ctrl.signal })
      .then((r) => setDemo(r.enabled))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  async function enter(localDemo = false) {
    if (submitting.current) return;
    const accountEmail = email.trim().toLowerCase();
    if (!localDemo && (!accountEmail || !password)) {
      setError("Informe seu e-mail e senha.");
      document.getElementById(!accountEmail ? "email" : "password")?.focus();
      return;
    }
    if (!localDemo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
      setError("Informe um e-mail válido.");
      document.getElementById("email")?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await signIn("credentials", {
        email: accountEmail,
        password,
        demo: localDemo ? "1" : "0",
        redirect: false,
      });
      if (!r?.ok || r.error) {
        setError("Não foi possível entrar. Confira seu e-mail e senha.");
        return;
      }
      router.replace(localDemo ? "/admin" : loginDestination(params.get("callbackUrl"), tracking));
      router.refresh();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AccessShell titleId="login-title">
      <p className={s.eyebrow}>{tracking ? "Pré-matrícula Get Wise" : "Portal Get Wise"}</p>
      <h1 id="login-title">{tracking ? "Acompanhe sua pré-matrícula" : "Bem-vindo de volta"}</h1>
      <p id="login-help" className={s.subtitle}>
        {tracking
          ? "Use o e-mail e a senha criados no cadastro. Para menores de 18 anos, use o e-mail do responsável."
          : "Entre para estudar ou acessar seu portal Get Wise."}
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void enter();
        }}
        className={s.form}
        aria-describedby={error ? "login-help login-error" : "login-help"}
      >
        <Field
          name="email"
          label="E-mail"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="username"
          className={s.field}
          placeholder="seuemail@exemplo.com"
          leadingIcon={<Mail size={17} />}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          label="Senha"
          compact
          className={s.field}
          labelAction={
            <Link href="/forgot-password" className={s.link}>
              Esqueci minha senha
            </Link>
          }
        />
        {params.get("verify") && (
          <p role="status" className={s.notice}>
            {params.get("verify") === "success"
              ? "E-mail confirmado. Você já pode entrar."
              : "O link não pôde ser confirmado. Entre na sua conta e solicite um novo envio no acompanhamento."}
          </p>
        )}
        {error && (
          <p id="login-error" role="alert" className={s.error}>
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit" className={s.primaryAction} aria-busy={busy}>
          <span>{busy ? "Entrando…" : tracking ? "Consultar situação" : "Entrar no portal"}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
      </form>
      <div className={s.trackingAccess}>
        <Button asChild variant="outline" className={s.secondaryAction}>
          <Link href={tracking ? "/login" : PRE_ENROLLMENT_LOGIN}>
            {!tracking && <ClipboardCheck size={17} aria-hidden="true" />}
            {tracking ? "Voltar ao acesso do portal" : "Acompanhar pré-matrícula"}
          </Link>
        </Button>
      </div>

      <div className={s.newStudent}>
        <p>{tracking ? "Ainda não enviou sua pré-matrícula?" : "Ainda não estuda com a gente?"}</p>
        <Button asChild variant="outline" className={s.secondaryAction}>
          <Link href="/register">
            Fazer matrícula online
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {demo && !tracking && (
        <div className={s.notice}>
          <p>Avaliação local</p>
          <Button disabled={busy} variant="outline" onClick={() => enter(true)}>
            Abrir painel administrativo
          </Button>
        </div>
      )}
    </AccessShell>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Carregando acesso…</p>}>
      <Login />
    </Suspense>
  );
}
