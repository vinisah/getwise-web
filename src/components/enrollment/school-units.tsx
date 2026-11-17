"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SchoolUnitSchema } from "@/lib/pre-enrollment/schema";
import { Field, ExitLink, fetchJson, type Errors } from "./fields";
import s from "./enrollment.module.css";
export type SchoolData = z.infer<typeof SchoolUnitSchema>;
type Unit = SchoolData & { id: string; version: number; courses: { course: { id: string; title: string } }[] };
const blank: SchoolData = {
  code: "",
  name: "",
  legalName: "",
  cnpj: "",
  zipCode: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "PR",
  phone: "",
  mobile: "",
  email: "",
  classification: "",
  notes: "",
  logoUrl: "",
  photos: [],
  partners: [],
  consultants: ["Secretaria", "Outro"],
  courseIds: [],
  isActive: true,
  enrollmentOpen: true,
};
const groups: { label: string; fields: [keyof SchoolData, string][] }[] = [
  {
    label: "Identificação",
    fields: [
      ["code", "Código"],
      ["name", "Nome fantasia"],
      ["legalName", "Razão social"],
      ["cnpj", "CNPJ"],
      ["classification", "Enquadramento"],
    ],
  },
  {
    label: "Endereço",
    fields: [
      ["zipCode", "CEP"],
      ["address", "Logradouro"],
      ["number", "Número"],
      ["complement", "Complemento"],
      ["neighborhood", "Bairro"],
      ["city", "Cidade"],
      ["state", "Estado (UF)"],
    ],
  },
  {
    label: "Contato",
    fields: [
      ["phone", "Telefone fixo"],
      ["mobile", "Celular"],
      ["email", "E-mail"],
    ],
  },
];
export function SchoolUnitList() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadedReload, setLoadedReload] = useState(-1);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const loading = loadedReload !== reload;
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/school-units", { signal: ctrl.signal })
      .then(setUnits)
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedReload(reload);
      });
    return () => ctrl.abort();
  }, [reload]);
  const filtered = units.filter((u) =>
    `${u.name} ${u.city} ${u.code}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
  );
  return (
    <div className={s.wide}>
      <div className={s.titleRow}>
        <div>
          <p className={s.eyebrow}>Get Wise · Unidades</p>
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>Onde o aprendizado acontece</h1>
          <p className={s.muted}>Cadastre as unidades e defina os cursos disponíveis para matrícula.</p>
        </div>
        <Button asChild>
          <Link href="/admin/school-units/new">Cadastrar unidade</Link>
        </Button>
      </div>
      <div className={s.toolbar}>
        <Field
          name="searchUnits"
          label="Buscar unidade"
          optional
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        {search && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setPage(1);
              document.getElementById("searchUnits")?.focus();
            }}
          >
            Limpar busca
          </Button>
        )}
      </div>
      {loading ? (
        <p role="status">Carregando unidades…</p>
      ) : error ? (
        <p role="alert">
          {error}
          <Button
            onClick={() => {
              setError("");
              setReload((v) => v + 1);
            }}
          >
            Tentar novamente
          </Button>
        </p>
      ) : (
        <>
          <p className={s.muted}>{filtered.length} unidade(s)</p>
          <div className={s.list}>
            {filtered.slice((page - 1) * 12, page * 12).map((u) => (
              <Link className={s.card} key={u.id} href={`/admin/school-units/${u.id}`}>
                <div className={s.titleRow}>
                  <h2>{u.name}</h2>
                  <span className={s.pill}>
                    {u.isActive && u.enrollmentOpen ? "Matrículas abertas" : "Indisponível para matrícula"}
                  </span>
                </div>
                <p className={s.muted}>
                  {u.city} / {u.state} · Unidade {u.code}
                </p>
                <p>{u.courses.map((c) => c.course.title).join(" · ") || "Nenhum curso vinculado"}</p>
                <span className={s.link}>Ver unidade →</span>
              </Link>
            ))}
          </div>
          {!filtered.length && <div className={s.card}>Nenhuma unidade encontrada.</div>}
          <div className={s.actions}>
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>Página {page}</span>
            <Button variant="outline" disabled={page * 12 >= filtered.length} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function SchoolUnitEditor({ initial }: { initial?: Unit }) {
  const router = useRouter();
  const [data, setData] = useState<SchoolData>(
    initial ? { ...initial, courseIds: initial.courses.map((c) => c.course.id) } : blank
  );
  const [courses, setCourses] = useState<{ id: string; title: string; isActive: boolean }[]>([]);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson("/api/school-units/courses", { signal: ctrl.signal })
      .then(setCourses)
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, []);
  function update<K extends keyof SchoolData>(key: K, v: SchoolData[K]) {
    setData((d) => ({ ...d, [key]: v }));
    setDirty(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErrors({});
    setError("");
    const parsed = SchoolUnitSchema.safeParse(data);
    if (!parsed.success) {
      const map = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
      setErrors(map);
      setError("Confira os campos indicados.");
      requestAnimationFrame(() => document.getElementById(Object.keys(map)[0])?.focus());
      return;
    }
    setBusy(true);
    try {
      await fetchJson(initial ? `/api/school-units/${initial.id}` : "/api/school-units", {
        method: initial ? "PUT" : "POST",
        body: JSON.stringify({ ...parsed.data, version: initial?.version }),
      });
      setDirty(false);
      router.push("/admin/school-units");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.wide}>
      <div className={s.titleRow}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{initial ? "Editar unidade" : "Cadastrar unidade"}</h1>
        <ExitLink dirty={dirty} href="/admin/school-units">
          Voltar às unidades
        </ExitLink>
      </div>
      <form noValidate onSubmit={save} className={s.card} style={{ marginTop: 24 }}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
          {groups.map((g) => (
            <fieldset className={s.section} key={g.label}>
              <legend>{g.label}</legend>
              <div className={s.grid}>
                {g.fields.map(([key, label]) => (
                  <Field
                    key={key}
                    name={key}
                    label={label}
                    value={String(data[key])}
                    onChange={(v) => update(key, v)}
                    error={errors[key]}
                    optional={!["code", "name", "legalName", "city", "state", "email"].includes(key)}
                    type={key === "email" ? "email" : "text"}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className={s.section}>
            <legend>Disponibilidade e cursos</legend>
            <div className={s.checks}>
              <label>
                <input type="checkbox" checked={data.isActive} onChange={(e) => update("isActive", e.target.checked)} />
                Unidade ativa
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={data.enrollmentOpen}
                  onChange={(e) => update("enrollmentOpen", e.target.checked)}
                />
                Receber pré-matrículas online
              </label>
            </div>
            <p className={s.muted}>
              Selecione os cursos oferecidos. Cursos inativos não aparecem no formulário público.
            </p>
            <div className={s.checks}>
              {courses.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={data.courseIds.includes(c.id)}
                    onChange={(e) =>
                      update(
                        "courseIds",
                        e.target.checked ? [...data.courseIds, c.id] : data.courseIds.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.title}
                  {!c.isActive && " (inativo)"}
                </label>
              ))}
            </div>
            {!courses.length && <p>Nenhum curso carregado. Cadastre os cursos na seção Cursos.</p>}
          </fieldset>
          <fieldset className={s.section}>
            <legend>Consultores e informações complementares</legend>
            <div className={s.stack}>
              <Field
                name="consultants"
                label="Consultores (um por linha)"
                type="textarea"
                value={data.consultants.join("\n")}
                onChange={(v) => update("consultants", v.split("\n"))}
              />
              <Field
                name="notes"
                label="Informações complementares"
                type="textarea"
                optional
                value={data.notes}
                onChange={(v) => update("notes", v)}
              />
            </div>
          </fieldset>
          <fieldset className={s.section}>
            <legend>Imagens da unidade</legend>
            <p className={s.muted}>Informe endereços HTTPS das imagens já hospedadas.</p>
            <div className={s.stack}>
              <Field
                name="logoUrl"
                label="Endereço do logo"
                type="url"
                optional
                value={data.logoUrl}
                onChange={(v) => update("logoUrl", v)}
                error={errors.logoUrl}
              />
              <Field
                name="photos"
                label="Endereços das fotos (um por linha)"
                type="textarea"
                optional
                value={data.photos.join("\n")}
                onChange={(v) => update("photos", v ? v.split("\n") : [])}
                error={Object.entries(errors).find(([k]) => k.startsWith("photos"))?.[1]}
              />
            </div>
          </fieldset>
          <fieldset className={s.section}>
            <legend>Sócios</legend>
            {data.partners.map((p, i) => (
              <div key={i} className={s.card} style={{ marginBottom: 12 }}>
                <div className={s.grid}>
                  {(
                    [
                      ["name", "Nome"],
                      ["birthDate", "Data de nascimento"],
                      ["document", "Documento"],
                      ["photoUrl", "Endereço HTTPS da foto"],
                    ] as const
                  ).map(([k, label]) => (
                    <Field
                      key={k}
                      name={`partners.${i}.${k}`}
                      label={label}
                      optional={k !== "name"}
                      type={k === "birthDate" ? "date" : "text"}
                      value={p[k]}
                      onChange={(v) =>
                        update(
                          "partners",
                          data.partners.map((x, ix) => (ix === i ? { ...x, [k]: v } : x))
                        )
                      }
                      error={errors[`partners.${i}.${k}`]}
                    />
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    update(
                      "partners",
                      data.partners.filter((_, ix) => ix !== i)
                    )
                  }
                >
                  Remover sócio deste formulário
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update("partners", [...data.partners, { name: "", birthDate: "", document: "", photoUrl: "" }])
              }
            >
              Adicionar sócio
            </Button>
          </fieldset>
        </fieldset>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <div className={s.actions}>
          <ExitLink dirty={dirty} href="/admin/school-units">
            Cancelar
          </ExitLink>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar unidade"}
          </Button>
        </div>
      </form>
    </div>
  );
}
export function SchoolUnitDetail({ unit }: { unit: Unit }) {
  return (
    <div className={s.wide}>
      <Link className={s.link} href="/admin/school-units">
        ← Unidades
      </Link>
      <div className={s.titleRow} style={{ margin: "24px 0" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800 }}>{unit.name}</h1>
          <p className={s.muted}>
            Unidade {unit.code} · {unit.isActive ? "Ativa" : "Inativa"}
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/school-units/${unit.id}/edit`}>Editar unidade</Link>
        </Button>
      </div>
      <div className={s.stack}>
        {groups.map((g) => (
          <section key={g.label} className={s.card}>
            <h2>{g.label}</h2>
            <dl className={s.summary}>
              {g.fields.map(([k, label]) => (
                <div key={k}>
                  <dt>{label}</dt>
                  <dd>{String(unit[k] || "Não informado")}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section className={s.card}>
          <h2>Cursos oferecidos</h2>
          <p className={s.muted}>
            {unit.enrollmentOpen ? "Pré-matrículas online abertas" : "Pré-matrículas online fechadas"}
          </p>
          {unit.courses.map((c) => (
            <p key={c.course.id}>{c.course.title}</p>
          ))}
          {!unit.courses.length && <p>Nenhum curso vinculado.</p>}
        </section>
        <section className={s.card}>
          <h2>Informações complementares</h2>
          <p>{unit.notes || "Não informado"}</p>
          <p>Consultores: {unit.consultants.join(" · ")}</p>
          <p>
            {unit.partners.length} sócio(s) · {unit.photos.length} foto(s)
          </p>
        </section>
      </div>
    </div>
  );
}
