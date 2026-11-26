"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CepSchema, municipalityKey, type Residence } from "@/lib/pre-enrollment/location-contract";
import { Field, fetchJson } from "./fields";
import type { CatalogUnit } from "./enrollment-form";
import s from "./enrollment.module.css";
export type LocationResult = { residence: Residence; localUnitIds: string[] };
export function LocationPicker({
  zipCode,
  setZipCode,
  units,
  selected,
  select,
  result,
  onResult,
  other,
  setOther,
}: {
  zipCode: string;
  setZipCode: (value: string) => void;
  units: CatalogUnit[];
  selected: string;
  select: (id: string) => void;
  result: LocationResult | null;
  onResult: (value: LocationResult | null) => void;
  other: boolean;
  setOther: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const lookupId = useRef(0);
  const current = result?.residence.zipCode === zipCode.replace(/\D/g, "") ? result : null;
  const alternatives = units.filter((u) => current && !current.localUnitIds.includes(u.id));
  const cities = [
    ...new Map(alternatives.map((u) => [municipalityKey(u.city, u.state), `${u.city} / ${u.state}`])).entries(),
  ];
  const shown = other
    ? alternatives.filter((u) => !city || municipalityKey(u.city, u.state) === city)
    : units.filter((u) => current?.localUnitIds.includes(u.id));
  async function lookup() {
    const id = ++lookupId.current;
    const parsed = CepSchema.safeParse(zipCode);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    onResult(null);
    try {
      const response = await fetchJson(`/api/auth/enrollment-location?cep=${parsed.data}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (id === lookupId.current) onResult(response);
    } catch (e) {
      if (id === lookupId.current) setError((e as Error).message);
    } finally {
      if (id === lookupId.current) setBusy(false);
    }
  }
  return (
    <section className={s.stack} aria-label="Residência e unidade">
      <p className={s.muted}>
        Informe o CEP residencial do aluno. Para menores, use o endereço onde o aluno mora, mesmo que seja diferente do
        responsável.
      </p>
      <Field
        name="student.zipCode"
        label="CEP residencial do aluno"
        value={zipCode}
        autoComplete="postal-code"
        onChange={(v) => {
          ++lookupId.current;
          setBusy(false);
          setCity("");
          setZipCode(v);
          onResult(null);
          select("");
          setError("");
        }}
        error={error}
      />
      <Button type="button" disabled={busy} aria-busy={busy} onClick={lookup}>
        {busy ? "Consultando CEP…" : "Consultar CEP"}
      </Button>
      <div aria-live="polite">
        {current && (
          <div className={s.notice}>
            <strong>
              {current.residence.city} / {current.residence.state}
            </strong>
            <br />
            Município identificado pelo CEP do aluno.
          </div>
        )}
        {current && !other && !shown.length && (
          <p className={s.notice}>
            Não há unidade aberta à pré-matrícula nesta cidade. Você pode solicitar análise para estudar em outra
            cidade.
          </p>
        )}
        {current && other && !alternatives.length && (
          <p className={s.notice}>
            Nenhuma unidade de outra cidade está aberta para pré-matrícula no momento. Consulte a secretaria ou volte às
            unidades da sua cidade.
          </p>
        )}
      </div>
      {current && (
        <>
          {other && alternatives.length > 0 && (
            <>
              <h3>Solicitar outra cidade</h3>
              <Field
                name="desiredCity"
                label="Cidade desejada"
                value={city}
                onChange={(v) => {
                  setCity(v);
                  select("");
                }}
                options={cities.map(([value, label]) => ({ value, label }))}
                optional
              />
            </>
          )}
          {shown.length > 0 && (
            <fieldset className={s.unitChoices}>
              <legend>{other ? "Unidade solicitada" : "Unidades da cidade do aluno"}</legend>
              {shown.map((u) => (
                <label key={u.id} className={s.unitChoice}>
                  <input
                    type="radio"
                    name="schoolUnitId"
                    value={u.id}
                    checked={selected === u.id}
                    onChange={() => select(u.id)}
                  />
                  <span>
                    <strong>{u.name}</strong>
                    <small>
                      {u.city} / {u.state}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <Button
            variant="link"
            type="button"
            onClick={() => {
              setOther(!other);
              select("");
            }}
          >
            {other ? "Voltar às unidades da minha cidade" : "Preciso estudar em outra cidade"}
          </Button>
          {other && alternatives.length > 0 && (
            <p className={s.notice}>
              Enviar este pedido cria uma pendência de análise. Não conclui a pré-matrícula e não reserva vaga.
            </p>
          )}
        </>
      )}
    </section>
  );
}
