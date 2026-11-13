"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Check, Palette, SlidersHorizontal, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_PREFS, THEMES, normalizePrefs, themeVars, type UiPrefs } from "@/lib/theme";
import { preferencesSchema } from "@/lib/preferences";
import { usePreferences } from "./preferences-provider";
import { PreferenceChoices } from "./preference-choices";
import { UnsavedPreferences } from "./unsaved-preferences";
import { TutorMessage } from "@/components/tutor/tutor-message";
import styles from "./preferences.module.css";

const ACCENTS = [
  { value: "auto", label: "Do tema" },
  { value: "#2A5CD6", label: "Azul", color: "#2A5CD6" },
  { value: "#2440CC", label: "Índigo", color: "#2440CC" },
  { value: "#6A53CC", label: "Violeta", color: "#6A53CC" },
  { value: "#D2382B", label: "Coral", color: "#D2382B" },
];

export function PreferencesEditor({ accountName, preview = false }: { accountName: string; preview?: boolean }) {
  const { prefs, commit } = usePreferences();
  const [draft, setDraft] = useState(prefs);
  const [saved, setSaved] = useState(prefs);
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [notice, setNotice] = useState("");
  const [demo, setDemo] = useState(0);
  const request = useRef<AbortController | null>(null);
  const nickname = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function transfer(save?: UiPrefs) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/me/prefs", {
        method: save ? "POST" : "GET",
        signal: controller.signal,
        cache: "no-store",
        headers: save ? { "Content-Type": "application/json" } : undefined,
        body: save ? JSON.stringify({ ...save, version }) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar suas preferências.");
      if (controller.signal.aborted) return;
      const next = normalizePrefs(data.prefs);
      setVersion(data.version);
      setSaved(next);
      setDraft(next);
      commit(next);
      setNicknameError("");
      if (save) setNotice("Preferências salvas na sua conta.");
    } catch (cause) {
      if (request.current !== controller) return;
      setError(
        controller.signal.aborted
          ? "A conexão demorou demais. Suas escolhas continuam aqui; tente novamente."
          : cause instanceof Error
            ? cause.message
            : "Não foi possível conectar. Tente novamente."
      );
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    void transfer();
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, []); // first load establishes the account version

  function update(patch: Partial<UiPrefs>) {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice("");
  }
  async function save() {
    const parsed = preferencesSchema.safeParse(draft);
    if (!parsed.success) {
      const message = parsed.error.issues[0].message;
      setNicknameError(message);
      nickname.current?.focus();
      return;
    }
    await transfer(parsed.data);
  }

  return (
    <div className={styles.page}>
      <div className={styles.introduction}>
        <span className={styles.eyebrow}>Meu espaço de aprendizado</span>
        <h2>Deixe o Get Wise com a sua cara.</h2>
        <p>
          Escolha como quer ser chamado e como prefere estudar. As mudanças valem para a sua conta, em qualquer
          dispositivo.
        </p>
      </div>
      {preview && (
        <p className={styles.note}>
          Você está em “Visualizar como”. Estas preferências pertencem à sua conta de administrador e não alteram a
          conta do aluno visualizado.
        </p>
      )}
      <div className={styles.layout}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          aria-label="Minhas preferências"
          className={styles.form}
        >
          <section className={styles.card} aria-labelledby="identity-title">
            <div className={styles.sectionTitle}>
              <UserRound size={20} />
              <h3 id="identity-title">Como podemos chamar você?</h3>
            </div>
            <label htmlFor="nickname" className={styles.fieldLabel}>
              Apelido
            </label>
            <Input
              ref={nickname}
              id="nickname"
              autoComplete="nickname"
              value={draft.nickname}
              maxLength={30}
              disabled={busy || !version}
              aria-invalid={!!nicknameError}
              aria-describedby="nickname-help nickname-error"
              placeholder={accountName.split(" ")[0] || "Seu apelido"}
              onChange={(event) => {
                update({ nickname: event.target.value });
                setNicknameError("");
              }}
            />
            <p id="nickname-help" className={styles.help}>
              Até 30 caracteres. Deixe em branco para usar seu nome. Matrícula e certificados mantêm o nome cadastrado
              pela escola.
            </p>
            <p id="nickname-error" className={styles.fieldError} aria-live="polite">
              {nicknameError}
            </p>
          </section>
          <section className={styles.card} aria-labelledby="appearance-title">
            <div className={styles.sectionTitle}>
              <Palette size={20} />
              <h3 id="appearance-title">Cores e aparência</h3>
            </div>
            <PreferenceChoices
              label="Tema do sistema"
              disabled={busy || !version}
              value={draft.theme}
              onChange={(theme) => update({ theme })}
              options={(Object.keys(THEMES) as UiPrefs["theme"][]).map((key) => ({
                value: key,
                label: THEMES[key].label,
                color: THEMES[key].sidebar,
              }))}
            />
            <PreferenceChoices
              label="Cor de destaque"
              disabled={busy || !version}
              value={draft.accent}
              onChange={(accent) => update({ accent })}
              options={ACCENTS}
            />
            <p className={styles.help}>Paletas selecionadas para manter textos e botões legíveis.</p>
            <PreferenceChoices
              label="Espaçamento"
              disabled={busy || !version}
              value={draft.density}
              onChange={(density) => update({ density })}
              options={[
                { value: "espacoso", label: "Confortável", description: "Mais espaço para ler" },
                { value: "compacto", label: "Compacto", description: "Mais conteúdo na tela" },
              ]}
            />
            <PreferenceChoices
              label="Cantos dos elementos"
              disabled={busy || !version}
              value={draft.radius}
              onChange={(radius) => update({ radius })}
              options={[
                { value: 10, label: "Discretos" },
                { value: 16, label: "Suaves" },
                { value: 22, label: "Arredondados" },
              ]}
            />
            <PreferenceChoices
              label="Estilo do menu"
              disabled={busy || !version}
              value={draft.sidebar}
              onChange={(sidebar) => update({ sidebar })}
              options={[
                { value: "gradiente", label: "Gradiente" },
                { value: "solida", label: "Cor sólida" },
              ]}
            />
          </section>
          <section className={styles.card} aria-labelledby="comfort-title">
            <div className={styles.sectionTitle}>
              <SlidersHorizontal size={20} />
              <h3 id="comfort-title">Conforto para aprender</h3>
            </div>
            <PreferenceChoices
              label="Animações da interface"
              disabled={busy || !version}
              value={draft.motion}
              onChange={(motion) => update({ motion })}
              options={[
                { value: "system", label: "Seguir meu dispositivo" },
                { value: "reduced", label: "Reduzir movimento" },
              ]}
            />
            <PreferenceChoices
              label="Ritmo das respostas da Wise"
              disabled={busy || !version}
              value={draft.tutorPace}
              onChange={(tutorPace) => update({ tutorPace })}
              options={[
                { value: "calm", label: "Suave", description: "Palavras aparecem com calma" },
                { value: "quick", label: "Ágil", description: "Uma leitura mais rápida" },
                { value: "instant", label: "Imediato", description: "Mostrar toda a resposta" },
              ]}
            />
            <p className={styles.help}>Ao reduzir movimento aqui ou no dispositivo, a resposta aparece completa.</p>
          </section>
          <div className={styles.feedback} aria-live="polite">
            {busy ? (
              <p> {version ? "Salvando suas preferências…" : "Carregando suas preferências…"}</p>
            ) : notice ? (
              <p className={styles.saved}>
                <Check size={17} />
                {notice}
              </p>
            ) : dirty && !error ? (
              <p>Você tem alterações para salvar.</p>
            ) : null}
            {error && (
              <div role="alert">
                <p>{error}</p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    void transfer();
                  }}
                >
                  {version ? "Carregar preferências salvas" : "Tentar carregar novamente"}
                </Button>
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <Button type="submit" disabled={busy || !version || !dirty} style={{ minWidth: 180 }}>
              Salvar preferências
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !version || !dirty}
              onClick={() => {
                setDraft(saved);
                setError("");
                setNicknameError("");
                setNotice("");
              }}
            >
              Descartar alterações
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !version}
              onClick={() => {
                setDraft(DEFAULT_PREFS);
                setNicknameError("");
                setNotice("Padrão selecionado. Salve para aplicar.");
              }}
            >
              Restaurar padrão
            </Button>
          </div>
        </form>
        <aside className={styles.previewColumn} aria-label="Prévia das preferências">
          <div className={styles.previewHeading}>
            <span className={styles.eyebrow}>Prévia ao vivo</span>
            <p>Experimente aqui. Salve para aplicar ao sistema.</p>
          </div>
          <div className={styles.preview} style={themeVars(normalizePrefs(draft)) as CSSProperties}>
            <div className={styles.previewMenu} style={{ background: "var(--sidebar)" }}>
              <BookOpen size={24} />
              <span>Get Wise</span>
            </div>
            <div className={styles.previewContent}>
              <span className={styles.previewTag}>Seu próximo passo</span>
              <h3>Olá, {draft.nickname.trim() || accountName.split(" ")[0] || "aluno"}!</h3>
              <p>Um espaço para aprender no seu ritmo.</p>
              <div className={styles.previewLesson}>
                <BookOpen size={20} />
                <div>
                  <strong>Uma conversa em inglês</strong>
                  <span>Pratique um pouco a cada dia</span>
                </div>
              </div>
              <span className={styles.previewAction}>Exemplo da cor dos botões</span>
            </div>
          </div>
          <div className={styles.wisePreview}>
            <h3>Experimente o ritmo da Wise</h3>
            <TutorMessage
              key={`${demo}-${draft.tutorPace}-${draft.motion}`}
              animate={demo > 0}
              pace={draft.tutorPace}
              reduceMotion={draft.motion === "reduced"}
              content="Podemos aprender **um passo de cada vez**. Vou ajudar você a praticar com calma e ganhar confiança no inglês."
            />
            <Button type="button" variant="outline" onClick={() => setDemo((value) => value + 1)}>
              Testar apresentação
            </Button>
          </div>
        </aside>
      </div>
      <UnsavedPreferences dirty={dirty} />
    </div>
  );
}
