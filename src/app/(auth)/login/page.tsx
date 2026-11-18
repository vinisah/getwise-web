"use client";
import { Suspense, useEffect, useState, type CSSProperties } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, fetchJson } from "@/components/enrollment/fields";
import { ArrowRight, ArrowUpRight, BookOpen, ClipboardCheck, Mail, MessagesSquare } from "lucide-react";
import { DEFAULT_PREFS, themeVars } from "@/lib/theme";
import s from "./login.module.css";

// Public brand surface only; personal portal preferences are left untouched.
const loginTheme = { ...themeVars(DEFAULT_PREFS), "--r": "22px" } as CSSProperties;
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
    <main className={s.surface} style={loginTheme}>
      <aside className={s.brand} aria-label="Get Wise">
        <Logo white height={53} />
        <div>
          <h2>
            Um novo idioma.
            <br />
            <span>Mais possibilidades.</span>
          </h2>
          <p className={s.brandCopy}>Seu espaço para aprender, acompanhar as aulas e se conectar com a Get Wise.</p>
          <ul className={s.benefits}>
            <li>
              <BookOpen size={17} aria-hidden="true" />
              Aulas e materiais
            </li>
            <li>
              <MessagesSquare size={17} aria-hidden="true" />
              Aprendizado e prática
            </li>
            <li>
              <ClipboardCheck size={17} aria-hidden="true" />
              Acompanhamento da pré-matrícula
            </li>
          </ul>
        </div>
        <p className={s.brandFoot}>
          Uma etapa de cada vez.
          <br />A gente segue com você.
        </p>
      </aside>
      <div className={s.right}>
        <header className={s.mobileHeader}>
          <Logo white height={47} />
          <span>
            Seu portal
            <br />
            de aprendizado
          </span>
        </header>
        <div className={s.access}>
          <section className={s.card} aria-labelledby="login-title">
            <p className={s.eyebrow}>Portal Get Wise</p>
            <h1 id="login-title">Bem-vindo de volta</h1>
            <p className={s.subtitle}>Entre para estudar ou acompanhar sua pré-matrícula.</p>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void enter();
              }}
              className={s.form}
              aria-describedby={error ? "login-error" : undefined}
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
                <span>{busy ? "Entrando…" : "Entrar no portal"}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
            </form>
            <div className={s.newStudent}>
              <p>Ainda não estuda com a gente?</p>
              <Button asChild variant="outline" className={s.secondaryAction}>
                <Link href="/register">
                  Fazer matrícula online
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </Button>
            </div>
            {demo && (
              <div className={s.notice}>
                <p>Avaliação local</p>
                <Button disabled={busy} variant="outline" onClick={() => enter(true)}>
                  Abrir painel administrativo
                </Button>
              </div>
            )}
          </section>
          <p className={s.footnote}>Get Wise — Speak English</p>
        </div>
      </div>
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
