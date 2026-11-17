"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/gw/logo";
import { statusLabels } from "@/lib/pre-enrollment/schema";
import { Field, fetchJson } from "./fields";
import s from "./enrollment.module.css";
type Item = {
  id: string;
  protocol: string;
  studentName: string;
  status: string;
  feedback: string;
  createdAt: string;
  schoolUnit: { name: string };
  course: { title: string };
};
function List({ admin }: { admin: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [result, setResult] = useState<{ items: Item[]; total: number; page: number }>({
    items: [],
    total: 0,
    page: 1,
  });
  const [query, setQuery] = useState(search.get("q") ?? "");
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [reload, setReload] = useState(0);
  const [mailStatus, setMailStatus] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const searchString = search.toString();
  const requestKey = `${searchString}:${admin}:${reload}`;
  const loading = loadedFor !== requestKey;
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (!admin) return;
    const ctrl = new AbortController();
    fetchJson("/api/auth/enrollment-catalog", { signal: ctrl.signal })
      .then((u) => {
        setUnits(u);
        const all = u.flatMap((unit: { courses: { course: { id: string; title: string } }[] }) =>
          unit.courses.map((c) => c.course)
        );
        setCourses([...new Map(all.map((c: { id: string; title: string }) => [c.id, c])).values()] as {
          id: string;
          title: string;
        }[]);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [admin]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson(`/api/pre-enrollments?${searchString}${admin ? "&scope=admin" : ""}`, { signal: ctrl.signal })
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setResult(data);
          setError("");
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedFor(requestKey);
      });
    return () => ctrl.abort();
  }, [searchString, admin, requestKey]);
  const path = admin ? "/admin/pre-enrollments" : "/pre-enrollments";
  function filter(k: string, v: string) {
    const next = new URLSearchParams(searchString);
    next.delete("page");
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${path}?${next}`);
  }
  return (
    <div className={admin ? s.wide : s.shell}>
      {!admin && (
        <header className={s.header}>
          <Logo height={40} />
          <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sair da conta
          </Button>
        </header>
      )}
      <div className={s.wide}>
        <div className={s.titleRow}>
          <div>
            <p className={s.eyebrow}>{admin ? "Secretaria" : "Seu acompanhamento"}</p>
            <h1 style={{ fontSize: 30, fontWeight: 800 }}>Pré-matrículas</h1>
            <p className={s.muted}>
              {admin
                ? "Analise as solicitações e oriente as famílias."
                : "Acompanhe cada aluno e veja as orientações da secretaria."}
            </p>
          </div>
          {!admin && (
            <Button asChild>
              <Link href="/register">Nova pré-matrícula</Link>
            </Button>
          )}
        </div>
        <form
          noValidate
          className={s.toolbar}
          onSubmit={(e) => {
            e.preventDefault();
            filter("q", query);
          }}
        >
          <Field name="searchApplications" label="Buscar aluno" optional value={query} onChange={setQuery} />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
          {query && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                filter("q", "");
                document.getElementById("searchApplications")?.focus();
              }}
            >
              Limpar busca
            </Button>
          )}
          <Field
            name="status"
            label="Situação"
            optional
            value={search.get("status") ?? ""}
            onChange={(v) => filter("status", v)}
            options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
          />
          {admin && (
            <>
              <Field
                name="unitFilter"
                label="Unidade"
                optional
                value={search.get("unit") ?? ""}
                onChange={(v) => filter("unit", v)}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
              />
              <Field
                name="courseFilter"
                label="Curso"
                optional
                value={search.get("course") ?? ""}
                onChange={(v) => filter("course", v)}
                options={courses.map((c) => ({ value: c.id, label: c.title }))}
              />
              <Field
                name="fromFilter"
                label="Enviadas a partir de"
                type="date"
                optional
                value={search.get("from") ?? ""}
                onChange={(v) => filter("from", v)}
              />
              <Field
                name="toFilter"
                label="Enviadas até"
                type="date"
                optional
                value={search.get("to") ?? ""}
                onChange={(v) => filter("to", v)}
              />
            </>
          )}
        </form>
        {loading ? (
          <p role="status" className={s.notice}>
            Carregando solicitações…
          </p>
        ) : error ? (
          <div role="alert" className={s.notice}>
            {error}
            <Button variant="link" onClick={() => setReload((v) => v + 1)}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <p className={s.muted}>{result.total} solicitação(ões)</p>
            <div className={s.list}>
              {result.items.map((item) => (
                <Link className={s.card} href={`${path}/${item.id}`} key={item.id}>
                  <div className={s.titleRow}>
                    <h2>{item.studentName}</h2>
                    <span className={s.pill}>{statusLabels[item.status]}</span>
                  </div>
                  <p className={s.muted}>
                    {item.schoolUnit.name} · {item.course.title}
                  </p>
                  <p className={s.muted}>
                    {item.protocol} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                  {item.feedback && <p className={s.notice}>{item.feedback}</p>}
                  <span className={s.link}>{admin ? "Analisar solicitação" : "Ver solicitação"} →</span>
                </Link>
              ))}
            </div>
            {!result.items.length && <div className={s.card}>Nenhuma pré-matrícula encontrada com estes filtros.</div>}
            <div className={s.actions}>
              <Button
                variant="outline"
                disabled={result.page <= 1}
                onClick={() => {
                  const p = new URLSearchParams(searchString);
                  p.set("page", String(result.page - 1));
                  router.push(`${path}?${p}`);
                }}
              >
                Anterior
              </Button>
              <span>Página {result.page}</span>
              <Button
                variant="outline"
                disabled={result.page * 20 >= result.total}
                onClick={() => {
                  const p = new URLSearchParams(searchString);
                  p.set("page", String(result.page + 1));
                  router.push(`${path}?${p}`);
                }}
              >
                Próxima
              </Button>
            </div>
          </>
        )}
        {!admin && (
          <section className={s.notice}>
            <p>Precisa confirmar seu e-mail?</p>
            <Button
              variant="link"
              disabled={mailBusy}
              onClick={async () => {
                setMailBusy(true);
                try {
                  const r = await fetchJson("/api/auth/resend-verification", { method: "POST" });
                  setMailStatus(
                    r.emailSent
                      ? "Confirmação enviada. Confira seu e-mail."
                      : "Não foi possível enviar. Fale com a secretaria ou tente novamente mais tarde."
                  );
                } catch (e) {
                  setMailStatus((e as Error).message);
                } finally {
                  setMailBusy(false);
                }
              }}
            >
              Reenviar confirmação
            </Button>
            <p role="status">{mailStatus}</p>
          </section>
        )}
      </div>
    </div>
  );
}
export function ApplicationList({ admin = false }: { admin?: boolean }) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <List admin={admin} />
    </Suspense>
  );
}
