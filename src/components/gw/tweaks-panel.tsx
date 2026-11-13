"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, X } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";
import {
  ACCENT_CHOICES,
  DEFAULT_PREFS,
  PREFS_COOKIE,
  RADIUS_CHOICES,
  THEMES,
  type ThemeId,
  type UiPrefs,
  normalizePrefs,
  themeVars,
} from "@/lib/theme";

function readCookie(): UiPrefs {
  if (typeof document === "undefined") return DEFAULT_PREFS;
  const m = document.cookie.match(new RegExp("(?:^|; )" + PREFS_COOKIE + "=([^;]*)"));
  if (!m) return DEFAULT_PREFS;
  try {
    return normalizePrefs(JSON.parse(decodeURIComponent(m[1])));
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyVars(prefs: UiPrefs) {
  const root = document.documentElement;
  const vars = themeVars(prefs);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  // chrome do navegador/PWA segue o tema
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta) meta.content = THEMES[prefs.theme].brand;
}

function writeCookie(prefs: UiPrefs) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=31536000; samesite=lax${secure}`;
}

function hasCookie() {
  return typeof document !== "undefined" && new RegExp("(?:^|; )" + PREFS_COOKIE + "=").test(document.cookie);
}

/** Painel de aparência: tema, cor de destaque, densidade, cantos, sidebar. */
export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<UiPrefs>(DEFAULT_PREFS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidrata o estado do painel: do cookie (o SSR já aplicou o mesmo tema → sem flash). Se o device
  // ainda não tem cookie, busca as prefs salvas no DB (cross-device) e aplica/grava o cookie.
  useEffect(() => {
    if (hasCookie()) {
      setPrefs(readCookie());
      return;
    }
    let alive = true;
    fetch("/api/me/prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.prefs) return;
        const p = normalizePrefs(d.prefs);
        setPrefs(p);
        applyVars(p);
        writeCookie(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Limpa o timer pendente ao desmontar (evita POST órfão).
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  function update(patch: Partial<UiPrefs>) {
    const next = normalizePrefs({ ...prefs, ...patch });
    setPrefs(next);
    applyVars(next);
    writeCookie(next);
    // Persiste no DB (best-effort, debounced).
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/me/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 600);
  }

  const Seg = ({
    value,
    options,
    onPick,
  }: {
    value: string | number;
    options: { v: string | number; label: string }[];
    onPick: (v: string | number) => void;
  }) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onPick(o.v)}
          style={{
            padding: "7px 12px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            border: `1px solid ${value === o.v ? "var(--accent)" : "var(--line)"}`,
            background: value === o.v ? "var(--accent-soft)" : "var(--card)",
            color: value === o.v ? "var(--accent)" : "var(--ink-2)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", margin: "16px 0 8px" }}>{children}</p>
  );

  return (
    <>
      <button
        className="gw-icon-btn"
        aria-label="Aparência"
        title="Aparência"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        }}
      >
        <Settings size={18} />
      </button>

      <AppDialog open={open} onClose={() => setOpen(false)} label="Aparência" placement="drawer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>Aparência</h2>
          <button className="gw-icon-btn sm" aria-label="Fechar" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <Label>Tema</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <button
              key={id}
              onClick={() => update({ theme: id })}
              style={{
                cursor: "pointer",
                borderRadius: 12,
                padding: 6,
                textAlign: "center",
                border: `2px solid ${prefs.theme === id ? "var(--accent)" : "var(--line)"}`,
                background: "var(--card)",
              }}
            >
              <div style={{ height: 34, borderRadius: 8, background: THEMES[id].sidebar }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", display: "block", marginTop: 5 }}>
                {id === "marinho" ? "Marinho" : id === "royal" ? "Royal" : "Premium"}
              </span>
            </button>
          ))}
        </div>

        <Label>Cor de destaque</Label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACCENT_CHOICES.map((c) => (
            <button
              key={c}
              onClick={() => update({ accent: c })}
              aria-label={c === "auto" ? "Automático" : c}
              title={c === "auto" ? "Automático" : c}
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                cursor: "pointer",
                border: `2px solid ${prefs.accent === c ? "var(--ink)" : "var(--line)"}`,
                background: c === "auto" ? "conic-gradient(from 0deg,#2A5CD6,#6A53CC,#D2382B,#2A5CD6)" : c,
              }}
            />
          ))}
        </div>

        <Label>Densidade</Label>
        <Seg
          value={prefs.density}
          onPick={(v) => update({ density: v as UiPrefs["density"] })}
          options={[
            { v: "espacoso", label: "Espaçoso" },
            { v: "compacto", label: "Compacto" },
          ]}
        />

        <Label>Cantos</Label>
        <Seg
          value={prefs.radius}
          onPick={(v) => update({ radius: Number(v) })}
          options={RADIUS_CHOICES.map((r) => ({ v: r, label: String(r) }))}
        />

        <Label>Sidebar</Label>
        <Seg
          value={prefs.sidebar}
          onPick={(v) => update({ sidebar: v as UiPrefs["sidebar"] })}
          options={[
            { v: "gradiente", label: "Gradiente" },
            { v: "solida", label: "Sólida" },
          ]}
        />
      </AppDialog>
    </>
  );
}
