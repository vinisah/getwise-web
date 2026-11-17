"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/app-dialog";
import { ApplicationData, isMinor, statusLabels } from "@/lib/pre-enrollment/schema";
import { EnrollmentForm } from "./enrollment-form";
import { Field, PersonSummary, fetchJson } from "./fields";
import s from "./enrollment.module.css";
type Entry = {
  id: string;
  version: number;
  data: ApplicationData;
  protocol: string;
  status: string;
  feedback: string;
  studentId: string | null;
  schoolUnit: { name: string };
  course: { title: string };
  applicant: { emailVerified: string | null };
};
export function ApplicationDetail({ id, admin = false }: { id: string; admin?: boolean }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [reload, setReload] = useState(0);
  const requestKey = `${id}:${admin}:${reload}`;
  const loading = loadedFor !== requestKey;
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson(`/api/pre-enrollments/${id}${admin ? "?scope=admin" : ""}`, { signal: ctrl.signal })
      .then((e) => {
        setEntry(e);
        setFeedback(e.feedback);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedFor(requestKey);
      });
    return () => ctrl.abort();
  }, [id, admin, requestKey]);
  async function decide() {
    if (!entry || busy) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/pre-enrollments/${id}`, {
        method: "POST",
        body: JSON.stringify({ version: entry.version, action, feedback }),
      });
      setMessage("Decisão registrada. A família já pode consultá-la no acompanhamento.");
      setAction("");
      setReload((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
      setAction("");
    } finally {
      setBusy(false);
    }
  }
  if (editing && entry) return <EnrollmentForm correction={entry} />;
  return (
    <div className={admin ? s.wide : s.shell}>
      <div className={s.wide}>
        <Link className={s.link} href={admin ? "/admin/pre-enrollments" : "/pre-enrollments"}>
          ← Voltar às pré-matrículas
        </Link>
        {loading ? (
          <p role="status" className={s.notice}>
            Carregando solicitação…
          </p>
        ) : (
          entry && (
            <>
              <div className={s.titleRow} style={{ margin: "24px 0" }}>
                <div>
                  <p className={s.eyebrow}>{entry.protocol}</p>
                  <h1 style={{ fontSize: 30, fontWeight: 800 }}>{entry.data.student.name}</h1>
                  <p className={s.muted}>
                    {entry.schoolUnit.name} · {entry.course.title}
                  </p>
                </div>
                <span className={s.pill}>{statusLabels[entry.status]}</span>
              </div>
              {message && (
                <p role="status" className={s.notice}>
                  {message}
                </p>
              )}
              {entry.feedback && (
                <div className={s.notice}>
                  <strong>Orientação da secretaria</strong>
                  <p>{entry.feedback}</p>
                </div>
              )}
              {!admin && entry.status === "CORRECTION" && (
                <Button onClick={() => setEditing(true)}>Corrigir e reenviar</Button>
              )}
              <div className={s.stack} style={{ marginTop: 24 }}>
                <section className={s.card}>
                  <h2>Aluno</h2>
                  <PersonSummary person={entry.data.student} />
                </section>
                {isMinor(entry.data.student.birthDate) && entry.data.guardian && (
                  <section className={s.card}>
                    <h2>Responsável · {entry.data.relationship}</h2>
                    <PersonSummary person={entry.data.guardian} />
                  </section>
                )}
                <section className={s.card}>
                  <h2>Cuidados com o aluno</h2>
                  <dl className={s.summary}>
                    <div>
                      <dt>Alergias</dt>
                      <dd>{entry.data.allergies === "YES" ? entry.data.allergyDetails : "Não"}</dd>
                    </div>
                    <div>
                      <dt>Aprendizagem/desenvolvimento</dt>
                      <dd>{entry.data.learningNeeds || "Não informado"}</dd>
                    </div>
                  </dl>
                </section>
                <section className={s.card}>
                  <h2>Atendimento e chegada</h2>
                  <dl className={s.summary}>
                    <div>
                      <dt>Consultor</dt>
                      <dd>{entry.data.consultant}</dd>
                    </div>
                    <div>
                      <dt>Como conheceu a escola</dt>
                      <dd>{entry.data.source}</dd>
                    </div>
                    <div>
                      <dt>O que mais gostou</dt>
                      <dd>{entry.data.favorite}</dd>
                    </div>
                    <div>
                      <dt>E-mail de acesso</dt>
                      <dd>{entry.applicant.emailVerified ? "Confirmado" : "Aguardando confirmação"}</dd>
                    </div>
                  </dl>
                </section>
                {admin && ["PENDING", "CORRECTION"].includes(entry.status) && (
                  <section className={s.card}>
                    <h2>Análise da secretaria</h2>
                    <p className={s.muted}>
                      A aprovação prepara a ficha do aluno. O plano e a matrícula são definidos em uma etapa posterior.
                    </p>
                    <Field
                      name="feedback"
                      label="Mensagem para a família"
                      type="textarea"
                      optional
                      value={feedback}
                      onChange={setFeedback}
                    />
                    <div className={s.actions}>
                      <Button disabled={busy} variant="outline" onClick={() => setAction("CORRECTION")}>
                        Solicitar ajustes
                      </Button>
                      <Button disabled={busy} variant="outline" onClick={() => setAction("REJECTED")}>
                        Não aprovar
                      </Button>
                      <Button disabled={busy || !entry.applicant.emailVerified} onClick={() => setAction("APPROVED")}>
                        Aprovar dados
                      </Button>
                    </div>
                    {!entry.applicant.emailVerified && (
                      <p className={s.notice}>A aprovação será liberada após a família confirmar o e-mail.</p>
                    )}
                  </section>
                )}
                {admin && entry.studentId && (
                  <section className={s.card}>
                    <h2>Próxima etapa</h2>
                    <div className={s.actions}>
                      <Button asChild variant="outline">
                        <Link href={`/admin/students/${entry.studentId}`}>Abrir ficha do aluno</Link>
                      </Button>
                      {entry.status === "APPROVED" && (
                        <Button asChild>
                          <Link
                            href={`/admin/enrollments/new?preEnrollmentId=${entry.id}&studentId=${entry.studentId}`}
                          >
                            Efetivar matrícula
                          </Link>
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </>
          )
        )}
        {error && (
          <div role="alert" className={s.notice}>
            {error}
            <Button
              variant="link"
              onClick={() => {
                setError("");
                setReload((v) => v + 1);
              }}
            >
              Atualizar solicitação
            </Button>
          </div>
        )}
        <AppDialog open={!!action} onClose={() => !busy && setAction("")} label="Confirmar decisão">
          <div style={{ padding: 24 }}>
            <h2>
              {action === "APPROVED"
                ? "Aprovar os dados?"
                : action === "CORRECTION"
                  ? "Solicitar correções?"
                  : "Não aprovar esta solicitação?"}
            </h2>
            <p>
              {action === "APPROVED"
                ? "A ficha do aluno será preparada para a etapa de matrícula. Não haverá cobrança nesta aprovação."
                : "A mensagem ficará disponível para a família no acompanhamento."}
            </p>
            {action !== "APPROVED" && !feedback.trim() && (
              <p className={s.error}>Escreva uma mensagem para explicar a decisão.</p>
            )}
            <div className={s.actions}>
              <Button variant="outline" disabled={busy} onClick={() => setAction("")}>
                Voltar
              </Button>
              <Button disabled={busy || (action !== "APPROVED" && !feedback.trim())} onClick={decide}>
                {busy ? "Registrando…" : "Confirmar decisão"}
              </Button>
            </div>
          </div>
        </AppDialog>
      </div>
    </div>
  );
}
