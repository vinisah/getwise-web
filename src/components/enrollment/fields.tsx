"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppDialog } from "@/components/ui/app-dialog";
import { useRouter } from "next/navigation";
import type { PersonData } from "@/lib/pre-enrollment/schema";
import s from "./enrollment.module.css";
export type Errors = Record<string, string>;
export function Field({
  name,
  label,
  value,
  onChange,
  type = "text",
  error,
  options,
  optional = false,
  disabled = false,
  autoComplete,
  className,
  placeholder,
  leadingIcon,
  trailingControl,
  labelAction,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  placeholder?: string;
  leadingIcon?: ReactNode;
  trailingControl?: ReactNode;
  labelAction?: ReactNode;
}) {
  const props = {
    id: name,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    disabled,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${name}-error` : undefined,
    required: !optional,
  };
  const fieldLabel = (
    <label htmlFor={name}>
      {label}
      {optional ? " (opcional)" : " *"}
    </label>
  );
  return (
    <div className={[s.field, className].filter(Boolean).join(" ")}>
      {labelAction ? (
        <div className={s.fieldLabelRow}>
          {fieldLabel}
          {labelAction}
        </div>
      ) : (
        fieldLabel
      )}
      {options ? (
        <select {...props}>
          <option value="">Selecione</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea className="resize-none" {...props} rows={4} />
      ) : leadingIcon || trailingControl ? (
        <div className={s.fieldControl}>
          {leadingIcon && (
            <span className={s.fieldIcon} aria-hidden="true">
              {leadingIcon}
            </span>
          )}
          <Input
            {...props}
            type={type}
            autoComplete={autoComplete}
            placeholder={placeholder}
            style={{ paddingLeft: leadingIcon ? 42 : undefined, paddingRight: trailingControl ? 52 : undefined }}
          />
          {trailingControl && <span className={s.fieldTrailing}>{trailingControl}</span>}
        </div>
      ) : (
        <Input {...props} type={type} autoComplete={autoComplete} placeholder={placeholder} />
      )}
      {error && (
        <span id={`${name}-error`} className={s.error}>
          {error}
        </span>
      )}
    </div>
  );
}
export const personLabels: Record<keyof PersonData, string> = {
  name: "Nome completo",
  cpf: "CPF",
  birthDate: "Data de nascimento",
  gender: "Gênero",
  maritalStatus: "Estado civil",
  profession: "Profissão",
  workplace: "Local de trabalho, escola ou universidade",
  phone: "Telefone com DDD",
  email: "E-mail",
  zipCode: "CEP",
  address: "Endereço",
  number: "Número",
  neighborhood: "Bairro",
};
export function PersonFields({
  person,
  prefix,
  onChange,
  errors,
  skipIdentity = false,
  minor = false,
}: {
  person: PersonData;
  prefix: string;
  onChange: (p: PersonData) => void;
  errors: Errors;
  skipIdentity?: boolean;
  minor?: boolean;
}) {
  return (
    <div className={s.grid}>
      {(Object.keys(personLabels) as (keyof PersonData)[])
        .filter((k) => !skipIdentity || !["name", "birthDate"].includes(k))
        .map((k) => (
          <Field
            key={k}
            name={`${prefix}.${k}`}
            label={personLabels[k]}
            value={person[k]}
            onChange={(v) => onChange({ ...person, [k]: v })}
            error={errors[`${prefix}.${k}`]}
            type={k === "birthDate" ? "date" : k === "email" ? "email" : k === "phone" ? "tel" : "text"}
            optional={k === "email" && minor}
            options={
              k === "gender"
                ? ["Feminino", "Masculino", "Outro", "Prefiro não informar"].map((v) => ({ value: v, label: v }))
                : k === "maritalStatus"
                  ? ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)", "Não se aplica"].map(
                      (v) => ({ value: v, label: v })
                    )
                  : undefined
            }
          />
        ))}
    </div>
  );
}
export function PersonSummary({ person }: { person: PersonData }) {
  return (
    <dl className={s.summary}>
      {(Object.keys(personLabels) as (keyof PersonData)[]).map((k) => (
        <div key={k}>
          <dt>{personLabels[k]}</dt>
          <dd>{k === "birthDate" ? person[k].split("-").reverse().join("/") : person[k] || "Não informado"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PasswordField({
  value,
  onChange,
  error,
  label = "Senha de acesso",
  compact = false,
  className,
  labelAction,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  labelAction?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Field
        name="password"
        label={label}
        value={value}
        onChange={onChange}
        type={show ? "text" : "password"}
        error={error}
        autoComplete="current-password"
        className={className}
        labelAction={labelAction}
        placeholder={compact ? "Sua senha de acesso" : undefined}
        leadingIcon={compact ? <LockKeyhole size={17} /> : undefined}
        trailingControl={
          compact ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              style={{ width: 44, height: 44 }}
              onClick={() => setShow(!show)}
              aria-pressed={show}
              aria-controls="password"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            >
              {show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </Button>
          ) : undefined
        }
      />
      {!compact && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? "Ocultar senha" : "Mostrar senha"}
        </Button>
      )}
    </div>
  );
}
export function ExitLink({
  dirty,
  href = "/login",
  children = "Voltar ao login",
}: {
  dirty: boolean;
  href?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => (dirty ? setOpen(true) : router.push(href))}>
        {children}
      </Button>
      <AppDialog open={open} onClose={() => setOpen(false)} label="Sair sem enviar?">
        <div style={{ padding: 24 }}>
          <h2>Sair sem enviar?</h2>
          <p>Os dados preenchidos nesta tela serão perdidos.</p>
          <div className={s.actions}>
            <Button onClick={() => setOpen(false)}>Continuar preenchendo</Button>
            <Button variant="outline" onClick={() => router.push(href)}>
              Sair sem salvar
            </Button>
          </div>
        </div>
      </AppDialog>
    </>
  );
}
export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Não foi possível concluir. Tente novamente."), {
      issues: data.issues,
    });
  return data;
}
