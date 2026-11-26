"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { Logo } from "@/components/gw/logo";
import { Button } from "@/components/ui/button";
import { PRE_ENROLLMENT_LOGIN, PRE_ENROLLMENT_PATH } from "@/lib/pre-enrollment/access";
import {
  ApplicationSchema,
  PersonSchema,
  SubmissionSchema,
  emptyApplication,
  emptyPerson,
  isMinor,
  type ApplicationData,
} from "@/lib/pre-enrollment/schema";
import { Errors, ExitLink, Field, PasswordField, PersonFields, PersonSummary, fetchJson } from "./fields";
import s from "./enrollment.module.css";
import { LocationPicker, type LocationResult } from "./location-picker";
import { PlacementSchema } from "@/lib/pre-enrollment/placement-schema";
import type { Residence } from "@/lib/pre-enrollment/location-contract";
export type PlacementView = {
  status: string;
  reason: string;
  feedback: string;
  snapshot: {
    student: { name: string; cpf: string; birthDate: string; zipCode: string };
    residence: Residence;
    unit: { id: string; name: string; city: string; state: string };
  };
};
export type CatalogUnit = {
  id: string;
  name: string;
  city: string;
  state: string;
  consultants: string[];
  courses: { course: { id: string; title: string; level: string } }[];
};
type Correction = {
  id: string;
  version: number;
  data: ApplicationData;
  protocol: string;
  placementRequests?: PlacementView[];
};
export function EnrollmentForm({ correction }: { correction?: Correction }) {
  const [data, setData] = useState<ApplicationData>(correction?.data ?? structuredClone(emptyApplication));
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [loadedReload, setLoadedReload] = useState(-1);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [other, setOther] = useState(!!correction?.placementRequests?.length);
  const [reason, setReason] = useState(correction?.placementRequests?.[0]?.reason ?? "");
  const [placementReceipt, setPlacementReceipt] = useState<{ id: string; protocol: string } | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const loading = loadedReload !== reload;
  const [done, setDone] = useState<{ protocol: string; emailSent?: boolean; emailVerified?: boolean } | null>(null);
  const requestId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const minor = !!data.student.birthDate && isMinor(data.student.birthDate);
  const unit = units.find((u) => u.id === data.schoolUnitId);
  const course = unit?.courses.find((c) => c.course.id === data.courseId)?.course;
  const currentLocation = location?.residence.zipCode === data.student.zipCode.replace(/\D/g, "") ? location : null;
  const approval = correction?.placementRequests?.[0];
  const authorized =
    approval?.status === "APPROVED" &&
    approval.snapshot.unit.id === data.schoolUnitId &&
    approval.snapshot.student.cpf === data.student.cpf.replace(/\D/g, "") &&
    approval.snapshot.student.name === data.student.name.trim() &&
    approval.snapshot.student.birthDate === data.student.birthDate &&
    approval.snapshot.residence.zipCode === currentLocation?.residence.zipCode &&
    approval.snapshot.residence.municipalityCode === currentLocation?.residence.municipalityCode;
  const local = !!currentLocation?.localUnitIds.includes(data.schoolUnitId);
  const eligible = !!currentLocation && (local || authorized);
  const contact = minor ? (data.guardian ?? emptyPerson) : data.student;
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/auth/enrollment-catalog", { signal: ctrl.signal })
      .then(setUnits)
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedReload(reload);
      });
    return () => ctrl.abort();
  }, [reload]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, done]);
  function update<K extends keyof ApplicationData>(key: K, value: ApplicationData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }
  function showIssues(issues: { path: (string | number | PropertyKey)[] | string; message: string }[]) {
    const next: Errors = {};
    for (const issue of issues) {
      const key = (Array.isArray(issue.path) ? issue.path.join(".") : issue.path).replace(/^data\./, "");
      next[key] ??= issue.message;
    }
    setErrors(next);
    setError("Confira os campos indicados para continuar.");
    requestAnimationFrame(() => document.getElementById(Object.keys(next)[0])?.focus());
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setErrors({});
    if (step === 0) {
      if (!currentLocation) {
        setError("Consulte o CEP residencial do aluno antes de continuar.");
        document.getElementById("student.zipCode")?.focus();
        return;
      }
      const check = PersonSchema.pick({ name: true, birthDate: true }).safeParse(data.student);
      const issues = check.success ? [] : check.error.issues.map((i) => ({ ...i, path: ["student", ...i.path] }));
      if (!unit)
        issues.unshift({ code: "custom", path: ["schoolUnitId"], message: "Selecione uma unidade disponível." });
      if (issues.length) return showIssues(issues);
      if (!local && !authorized) {
        const input = {
          student: data.student,
          schoolUnitId: data.schoolUnitId,
          reason,
          contact: { name: contact.name, email: contact.email },
        };
        const parsed = PlacementSchema.safeParse(input);
        if (!parsed.success) return showIssues(parsed.error.issues);
        if (!correction && (password.length < 8 || password.length > 72))
          return showIssues([{ path: "password", message: "Use uma senha entre 8 e 72 caracteres." }]);
        requestId.current ??= crypto.randomUUID();
        setBusy(true);
        try {
          const response = await fetchJson(
            correction ? `/api/pre-enrollments/${correction.id}/placement` : "/api/auth/enrollment-placement",
            {
              method: correction ? "PUT" : "POST",
              body: JSON.stringify({
                data: parsed.data,
                password,
                requestId: requestId.current,
                version: correction?.version,
              }),
            }
          );
          setPlacementReceipt(response);
          setDirty(false);
          setPassword("");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
        return;
      }
      if (minor && !data.guardian) setData((d) => ({ ...d, guardian: { ...emptyPerson } }));
      if (!minor && data.guardian) setData((d) => ({ ...d, guardian: null, relationship: "" }));
      setStep(1);
      return;
    }
    const check = ApplicationSchema.safeParse(data);
    if (!eligible) {
      setStep(0);
      setError("Confira novamente o CEP e a unidade antes de enviar.");
      return;
    }
    if (!check.success) {
      setStep(1);
      return showIssues(check.error.issues);
    }
    if (step === 1) {
      setData(check.data);
      setStep(2);
      return;
    }
    if (!correction) {
      requestId.current ??= crypto.randomUUID();
      const checkAll = SubmissionSchema.safeParse({ data: check.data, password, requestId: requestId.current });
      if (!checkAll.success) return showIssues(checkAll.error.issues);
    }
    setBusy(true);
    try {
      const result = correction
        ? await fetchJson(`/api/pre-enrollments/${correction.id}`, {
            method: "PUT",
            body: JSON.stringify({ data: check.data, version: correction.version }),
          })
        : await fetchJson("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ data: check.data, password, requestId: requestId.current }),
          });
      setDone(correction ? { protocol: correction.protocol, emailVerified: true } : result);
      setDirty(false);
      setPassword("");
    } catch (err) {
      const e = err as Error & { issues?: { path: string; message: string }[] };
      if (e.issues) {
        setStep(1);
        showIssues(e.issues);
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.shell}>
      <header className={s.header}>
        <Logo height={40} />
        <ExitLink dirty={dirty && !done && !placementReceipt} href={correction ? "/pre-enrollments" : "/login"} />
      </header>
      <div className={s.layout}>
        <aside className={s.intro}>
          <div className={s.eyebrow}>Get Wise · Sua próxima etapa</div>
          <h1>Seu inglês começa com uma conversa.</h1>
          <p>
            Conte um pouco sobre você. Nossa secretaria vai analisar sua pré-matrícula e orientar os próximos passos.
          </p>
          <ol className={s.steps}>
            {["Residência e unidade", "Dados e curso", "Revisão e envio"].map((label, i) => (
              <li key={label} aria-current={!done && step === i ? "step" : undefined}>
                <span className={s.stepNumber}>{done || i < step ? "✓" : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          {unit && (
            <p style={{ marginTop: 30 }}>
              <MapPin size={16} style={{ display: "inline" }} /> {unit.name}
              <br />
              {unit.city} / {unit.state}
            </p>
          )}
        </aside>
        <div className={s.card}>
          {placementReceipt ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                Pedido enviado à direção
              </h2>
              <p className={s.notice}>
                Aguarde a análise. Sua pré-matrícula ainda não foi concluída e nenhuma vaga foi reservada.
              </p>
              <p>
                Protocolo <strong>{placementReceipt.protocol}</strong>
              </p>
              <p>
                {data.student.name} · {unit?.name}
              </p>
              <p className={s.muted}>
                Entre com o e-mail e a senha do cadastro {minor ? "do responsável" : "do aluno"} para acompanhar a
                decisão e continuar.
              </p>
              <Button asChild>
                <Link href={correction ? `/pre-enrollments/${correction.id}` : PRE_ENROLLMENT_LOGIN}>
                  Acompanhar pedido
                </Link>
              </Button>
            </>
          ) : done ? (
            <>
              <CheckCircle2 size={38} color="var(--success)" />
              <h2 ref={heading} tabIndex={-1} style={{ marginTop: 20 }}>
                {correction ? "Correções enviadas" : "Recebemos sua pré-matrícula"}
              </h2>
              <p className={s.muted}>
                A secretaria vai analisar os dados. Sua matrícula será efetivada após essa etapa.
              </p>
              <div className={s.notice}>
                Protocolo <strong>{done.protocol}</strong>
                <br />
                {unit?.name} · {course?.title}
              </div>
              {!done.emailVerified && (
                <p role="status">
                  {done.emailSent
                    ? "Enviamos a confirmação para o e-mail de acesso informado. Confira também a caixa de spam."
                    : "Sua pré-matrícula foi salva, mas não conseguimos enviar o e-mail de confirmação. Entre para acompanhar e tentar o reenvio, ou fale com a secretaria."}
                </p>
              )}
              <div className={`${s.actions} ${s.formActions}`}>
                <Button asChild>
                  <Link href={correction ? PRE_ENROLLMENT_PATH : PRE_ENROLLMENT_LOGIN}>
                    Acompanhar pré-matrícula <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <form noValidate onSubmit={submit}>
              <h2 ref={heading} tabIndex={-1}>
                {["Onde o aluno vai estudar?", "Conhecendo o aluno", "Tudo certo para enviar?"][step]}
              </h2>
              <p className={s.muted}>
                {
                  [
                    "Consulte o CEP, escolha a unidade e informe quem vai estudar.",
                    "Os campos com * são obrigatórios. Quando necessário, informe “Não se aplica”.",
                    "Confira as informações. Você pode voltar e corrigir qualquer campo.",
                  ][step]
                }
              </p>
              <fieldset disabled={busy || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                {step === 0 && (
                  <section className={s.section}>
                    <div className={s.stack}>
                      <LocationPicker
                        zipCode={data.student.zipCode}
                        setZipCode={(v) => update("student", { ...data.student, zipCode: v })}
                        units={units}
                        selected={data.schoolUnitId}
                        select={(v) => {
                          setData((d) => ({ ...d, schoolUnitId: v, courseId: "", consultant: "Secretaria" }));
                          setDirty(true);
                        }}
                        result={location}
                        onResult={setLocation}
                        other={other}
                        setOther={setOther}
                      />
                      {errors.schoolUnitId && <p className={s.error}>{errors.schoolUnitId}</p>}
                      <Field
                        name="student.name"
                        label="Nome completo do aluno"
                        value={data.student.name}
                        onChange={(v) => update("student", { ...data.student, name: v })}
                        error={errors["student.name"]}
                        autoComplete="name"
                      />
                      <Field
                        name="student.birthDate"
                        label="Data de nascimento do aluno"
                        type="date"
                        value={data.student.birthDate}
                        onChange={(v) => update("student", { ...data.student, birthDate: v })}
                        error={errors["student.birthDate"]}
                      />
                      {minor && (
                        <p className={s.notice}>
                          Como o aluno tem menos de 18 anos, também vamos precisar dos dados do responsável. O acesso
                          será pelo e-mail dele.
                        </p>
                      )}
                      {currentLocation && other && unit && !local && (
                        <>
                          <Field
                            name="student.cpf"
                            label="CPF do aluno"
                            value={data.student.cpf}
                            onChange={(v) => update("student", { ...data.student, cpf: v })}
                            error={errors["student.cpf"]}
                          />
                          {authorized ? (
                            <p className={s.notice}>
                              Exceção autorizada para este aluno, CEP e unidade. A pré-matrícula ainda será analisada
                              pela secretaria.
                            </p>
                          ) : (
                            <>
                              <Field
                                name="reason"
                                label="Por que precisa estudar nesta unidade?"
                                type="textarea"
                                value={reason}
                                onChange={setReason}
                                error={errors.reason}
                              />
                              {minor && (
                                <Field
                                  name="contact.name"
                                  label="Nome completo do responsável"
                                  value={contact.name}
                                  onChange={(v) => update("guardian", { ...contact, name: v })}
                                  error={errors["contact.name"]}
                                />
                              )}
                              <Field
                                name="contact.email"
                                label={minor ? "E-mail de acesso do responsável" : "E-mail de acesso do aluno"}
                                type="email"
                                value={contact.email}
                                onChange={(v) => update(minor ? "guardian" : "student", { ...contact, email: v })}
                                error={errors["contact.email"]}
                              />
                              {!correction && (
                                <>
                                  <p className={s.muted}>Crie uma senha ou use a senha da sua conta existente.</p>
                                  <PasswordField value={password} onChange={setPassword} error={errors.password} />
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                )}
                {step === 1 && (
                  <>
                    <fieldset className={s.section}>
                      <legend>Curso e atendimento</legend>
                      <div className={s.grid}>
                        <Field
                          name="courseId"
                          label="Curso"
                          value={data.courseId}
                          onChange={(v) => update("courseId", v)}
                          error={errors.courseId}
                          options={(unit?.courses ?? []).map((c) => ({ value: c.course.id, label: c.course.title }))}
                        />
                        <Field
                          name="consultant"
                          label="Consultor que atendeu"
                          value={unit?.consultants.includes(data.consultant) ? data.consultant : "Outro"}
                          onChange={(v) => update("consultant", v)}
                          error={errors.consultant}
                          options={[...new Set([...(unit?.consultants ?? []), "Outro"])].map((v) => ({
                            value: v,
                            label: v,
                          }))}
                        />
                        {(!unit?.consultants.includes(data.consultant) || data.consultant === "Outro") && (
                          <Field
                            name="consultantOther"
                            label="Nome do consultor ou atendimento"
                            value={data.consultant === "Outro" ? "" : data.consultant}
                            onChange={(v) => update("consultant", v)}
                          />
                        )}
                      </div>
                      {!unit?.courses.length && (
                        <p className={s.notice}>
                          Esta unidade não tem cursos disponíveis. Volte e escolha outra unidade.
                        </p>
                      )}
                    </fieldset>
                    <fieldset className={s.section}>
                      <legend>Dados do aluno</legend>
                      <PersonFields
                        person={data.student}
                        prefix="student"
                        onChange={(p) => update("student", p)}
                        errors={errors}
                        skipIdentity
                        minor={minor}
                      />
                    </fieldset>
                    {minor && data.guardian && (
                      <fieldset className={s.section}>
                        <legend>Dados do responsável</legend>
                        <p className={s.muted}>
                          O e-mail abaixo será usado para entrar e acompanhar esta e outras pré-matrículas da família.
                        </p>
                        <div className={s.notice}>
                          <Field
                            name="relationship"
                            label="Vínculo com o aluno"
                            value={data.relationship}
                            onChange={(v) => update("relationship", v)}
                            error={errors.relationship}
                          />
                          <Button
                            type="button"
                            variant="link"
                            onClick={() =>
                              update("guardian", {
                                ...data.guardian!,
                                address: data.student.address,
                                number: data.student.number,
                                neighborhood: data.student.neighborhood,
                                zipCode: data.student.zipCode,
                              })
                            }
                          >
                            Usar o mesmo endereço do aluno
                          </Button>
                        </div>
                        <PersonFields
                          person={data.guardian}
                          prefix="guardian"
                          onChange={(p) => update("guardian", p)}
                          errors={errors}
                        />
                      </fieldset>
                    )}
                    <fieldset className={s.section}>
                      <legend>Cuidados com o aluno</legend>
                      <p className={s.muted}>
                        Estas informações são apenas sobre o aluno e ajudam a equipe a acolhê-lo.
                      </p>
                      <div className={s.stack}>
                        <Field
                          name="allergies"
                          label="O aluno tem alguma alergia?"
                          value={data.allergies}
                          onChange={(v) => update("allergies", v as "YES" | "NO")}
                          options={[
                            { value: "NO", label: "Não" },
                            { value: "YES", label: "Sim" },
                          ]}
                        />
                        {data.allergies === "YES" && (
                          <Field
                            name="allergyDetails"
                            label="Qual alergia?"
                            type="textarea"
                            value={data.allergyDetails}
                            onChange={(v) => update("allergyDetails", v)}
                            error={errors.allergyDetails}
                          />
                        )}
                        <Field
                          name="learningNeeds"
                          label="Condição ou necessidade específica de aprendizagem/desenvolvimento"
                          type="textarea"
                          value={data.learningNeeds}
                          onChange={(v) => update("learningNeeds", v)}
                          error={errors.learningNeeds}
                          optional
                        />
                      </div>
                    </fieldset>
                    <fieldset className={s.section}>
                      <legend>Sua chegada à Get Wise</legend>
                      <div className={s.grid}>
                        <Field
                          name="source"
                          label="Como conheceu nossa escola?"
                          value={data.source}
                          onChange={(v) => update("source", v)}
                          error={errors.source}
                        />
                        <Field
                          name="favorite"
                          label="O que mais gostou da escola até aqui?"
                          value={data.favorite}
                          onChange={(v) => update("favorite", v)}
                          error={errors.favorite}
                        />
                      </div>
                    </fieldset>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className={s.notice}>
                      <strong>{unit?.name}</strong>
                      <br />
                      {course?.title}
                      <br />
                      Atendimento: {data.consultant}
                    </div>
                    <details open className={s.section}>
                      <summary>Dados do aluno</summary>
                      <PersonSummary person={data.student} />
                    </details>
                    {minor && data.guardian && (
                      <details className={s.section}>
                        <summary>Dados do responsável · {data.relationship}</summary>
                        <PersonSummary person={data.guardian} />
                      </details>
                    )}
                    <details className={s.section}>
                      <summary>Cuidados e informações complementares</summary>
                      <dl className={s.summary}>
                        <div>
                          <dt>Alergias do aluno</dt>
                          <dd>{data.allergies === "YES" ? data.allergyDetails : "Não"}</dd>
                        </div>
                        <div>
                          <dt>Aprendizagem</dt>
                          <dd>{data.learningNeeds || "Não informado"}</dd>
                        </div>
                        <div>
                          <dt>Como conheceu a escola</dt>
                          <dd>{data.source}</dd>
                        </div>
                        <div>
                          <dt>O que mais gostou</dt>
                          <dd>{data.favorite}</dd>
                        </div>
                      </dl>
                    </details>
                    {!correction && (
                      <section className={s.section}>
                        <h3>Seu acesso para acompanhar</h3>
                        <p className={s.muted}>{minor ? data.guardian?.email : data.student.email}</p>
                        <p className={s.muted}>
                          Crie uma senha com pelo menos 8 caracteres. Se já tem conta, use sua senha atual.
                        </p>
                        <PasswordField value={password} onChange={setPassword} error={errors.password} />
                      </section>
                    )}
                  </>
                )}
              </fieldset>
              {loading && (
                <p role="status" className={s.notice}>
                  Carregando unidades e cursos…
                </p>
              )}
              {!loading && !units.length && (
                <p className={s.notice}>Nenhuma unidade disponível neste momento. Entre em contato com a secretaria.</p>
              )}
              {error && (
                <div role="alert" className={s.error} style={{ marginTop: 20 }}>
                  {error}
                  {!units.length && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setError("");
                        setReload((v) => v + 1);
                      }}
                    >
                      Tentar novamente
                    </Button>
                  )}
                </div>
              )}
              <div className={`${s.actions} ${s.formActions}`}>
                {step > 0 ? (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep(step - 1);
                      setErrors({});
                      setError("");
                    }}
                  >
                    Voltar
                  </Button>
                ) : (
                  <span className={s.muted}>Etapa 1 de 3</span>
                )}
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    busy ||
                    !units.length ||
                    (step === 0 && other && !unit) ||
                    (step === 1 && !unit?.courses.length)
                  }
                  aria-busy={busy}
                >
                  {busy
                    ? "Enviando…"
                    : step === 2
                      ? correction
                        ? "Enviar correções"
                        : "Enviar pré-matrícula"
                      : step === 1
                        ? "Revisar pré-matrícula"
                        : other && !eligible
                          ? "Solicitar análise da direção"
                          : "Continuar com esta unidade"}
                  <ArrowRight size={16} />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
