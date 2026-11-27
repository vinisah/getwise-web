"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/app-dialog";
import { ApplicationData, isMinor, statusLabels } from "@/lib/pre-enrollment/schema";
import { EnrollmentForm, type PlacementView } from "./enrollment-form";
import { Field, PersonSummary, fetchJson } from "./fields";
import s from "./enrollment.module.css";
import { ReviewSection } from "./review-section";
type Entry = {
  id: string;
  version: number;
  data: ApplicationData;
  protocol: string;
  status: string;
  feedback: string;
  studentId: string | null;
  schoolUnit: { name: string };
  course: { title: string } | null;
  placementRequests?: PlacementView[];
  canDecidePlacement?: boolean;
  geographyRequired?: boolean;
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
      await fetchJson(`/api/pre-enrollments/${id}${entry.status === "PLACEMENT_PENDING" ? "/placement" : ""}`, {
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
  const placement = entry?.placementRequests?.[0];
  const placementMessages: Record<string, string> = {
    PENDING: "Aguarde a análise. Sua pré-matrícula ainda não foi concluída e nenhuma vaga foi reservada.",
    APPROVED:
      "A direção autorizou esta unidade para o aluno e o CEP analisados. A vaga e a matrícula dependem das próximas etapas.",
    REJECTED:
      entry?.status === "PLACEMENT_REJECTED"
        ? "A exceção não foi autorizada. Você pode escolher uma unidade da sua cidade ou revisar seu pedido."
        : "A direção recusou o pedido para esta unidade. A unidade atual aparece no início da ficha.",
    SUPERSEDED:
      "Este pedido perdeu a validade após a alteração da pré-matrícula. Confira a unidade atual no início da ficha.",
  };
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
                    {entry.schoolUnit.name} · {entry.course?.title ?? "Curso a definir após a autorização"}
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
              {placement && (
                <section className={`${s.card} ${s.placementCard}`}>
                  <h2>
                    {entry.status === "PLACEMENT_PENDING"
                      ? "Pedido enviado à direção"
                      : "Pedido para estudar em outra cidade"}
                  </h2>
                  <p className={s.notice}>
                    {placementMessages[placement.status] ?? "Consulte abaixo os dados do pedido analisado."}
                  </p>
                  <dl className={s.summary}>
                    <div>
                      <dt>Residência do aluno analisada</dt>
                      <dd>
                        {placement.snapshot.residence.city} / {placement.snapshot.residence.state} · CEP{" "}
                        {placement.snapshot.residence.zipCode}
                      </dd>
                    </div>
                    <div>
                      <dt>Unidade solicitada</dt>
                      <dd>{placement.snapshot.unit.name}</dd>
                    </div>
                    <div>
                      <dt>Motivo da família</dt>
                      <dd>{placement.reason}</dd>
                    </div>
                  </dl>
                  {placement.feedback && (
                    <p className={s.notice}>
                      <strong>Justificativa da direção</strong>
                      <br />
                      {placement.feedback}
                    </p>
                  )}
                  {!admin && entry.status.startsWith("PLACEMENT_") && (
                    <div className={s.actions}>
                      <Button variant="outline" onClick={() => setEditing(true)}>
                        Revisar CEP ou unidade
                      </Button>
                      {entry.status === "PLACEMENT_AUTHORIZED" ? (
                        <Button onClick={() => setEditing(true)}>Continuar pré-matrícula</Button>
                      ) : (
                        <Button disabled>Concluir pré-matrícula</Button>
                      )}
                    </div>
                  )}
                  {admin &&
                    entry.status === "PLACEMENT_PENDING" &&
                    (entry.canDecidePlacement ? (
                      <>
                        <Field
                          name="placementFeedback"
                          label="Justificativa da direção"
                          type="textarea"
                          value={feedback}
                          onChange={setFeedback}
                        />
                        <p className={s.muted}>Obrigatória para autorizar ou recusar. Será apresentada à família.</p>
                        <div className={s.actions}>
                          <Button
                            disabled={busy || !feedback.trim()}
                            variant="outline"
                            onClick={() => setAction("REJECTED")}
                          >
                            Recusar exceção
                          </Button>
                          <Button disabled={busy || !feedback.trim()} onClick={() => setAction("APPROVED")}>
                            Autorizar esta unidade
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className={s.notice}>
                        Somente a direção designada pode decidir este pedido. A secretaria acompanha o andamento.
                      </p>
                    ))}
                </section>
              )}
              {!admin && entry.status === "CORRECTION" && (
                <Button onClick={() => setEditing(true)}>Corrigir e reenviar</Button>
              )}
              <div className={s.stack} style={{ marginTop: 24 }}>
                <div className={admin ? s.card : s.stack}>
                  <ReviewSection title="Aluno" initiallyOpen collapsible={admin}>
                    <PersonSummary person={entry.data.student} />
                  </ReviewSection>
                  {isMinor(entry.data.student.birthDate) && entry.data.guardian && (
                    <ReviewSection title={`Responsável · ${entry.data.relationship}`} initiallyOpen collapsible={admin}>
                      <PersonSummary person={entry.data.guardian} />
                    </ReviewSection>
                  )}
                  <ReviewSection title="Cuidados com o aluno" collapsible={admin}>
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
                  </ReviewSection>
                  <ReviewSection title="Atendimento e chegada" collapsible={admin}>
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
                  </ReviewSection>
                </div>
                {admin && ["PENDING", "CORRECTION", "APPROVED"].includes(entry.status) && (
                  <section className={s.card}>
                    <h2>
                      {entry.status === "APPROVED" ? "Regularização antes da matrícula" : "Análise da secretaria"}
                    </h2>
                    {entry.status === "APPROVED" && (
                      <p className={s.notice}>
                        Se precisar corrigir o endereço ou a unidade, explique o motivo e solicite ajustes. A ficha
                        voltará para a família e precisará de nova análise antes da efetivação.
                      </p>
                    )}
                    {!entry.geographyRequired && (
                      <p className={s.notice}>
                        Cadastro anterior à consulta de CEP. Se o endereço estiver desatualizado ou o CEP não puder ser
                        consultado, use “Solicitar ajustes” para a família informar o CEP residencial atual. Os demais
                        dados serão preservados.
                      </p>
                    )}
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
                      {entry.status !== "APPROVED" && (
                        <Button disabled={busy} variant="outline" onClick={() => setAction("REJECTED")}>
                          Não aprovar
                        </Button>
                      )}
                      {entry.status !== "APPROVED" && (
                        <Button disabled={busy || !entry.applicant.emailVerified} onClick={() => setAction("APPROVED")}>
                          Aprovar dados
                        </Button>
                      )}
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
              {entry?.status === "PLACEMENT_PENDING"
                ? action === "APPROVED"
                  ? "Autorizar esta unidade?"
                  : "Recusar a exceção?"
                : action === "APPROVED"
                  ? "Aprovar os dados?"
                  : action === "CORRECTION"
                    ? "Solicitar correções?"
                    : "Não aprovar esta solicitação?"}
            </h2>
            <p>
              {entry?.status === "PLACEMENT_PENDING"
                ? "A decisão ficará visível para a família. Autorizar permite retomar o formulário; não reserva vaga nem efetiva matrícula."
                : action === "APPROVED"
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
              <Button
                disabled={
                  busy || ((action !== "APPROVED" || entry?.status === "PLACEMENT_PENDING") && !feedback.trim())
                }
                onClick={decide}
              >
                {busy ? "Registrando…" : "Confirmar decisão"}
              </Button>
            </div>
          </div>
        </AppDialog>
      </div>
    </div>
  );
}
