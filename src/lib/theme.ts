/**
 * Sistema de temas (portado do mockup novo). Gera as CSS vars a partir das preferências
 * do usuário. Aplicado inline no <html> pelo layout-raiz (SSR, sem flash) a partir de um
 * cookie visual, e sincronizado pelo PreferencesProvider. A fonte persistente é User.uiPrefs.
 */

export type ThemeId = "marinho" | "royal" | "premium";
export type DensityId = "espacoso" | "compacto";
export type SidebarId = "gradiente" | "solida";

export interface UiPrefs {
  theme: ThemeId;
  accent: string; // "auto" ou hex (#RRGGBB)
  density: DensityId;
  radius: number; // 10 | 16 | 22
  sidebar: SidebarId;
  nickname: string;
  motion: "system" | "reduced";
  tutorPace: "calm" | "quick" | "instant";
}

export const DEFAULT_PREFS: UiPrefs = {
  theme: "marinho",
  accent: "auto",
  density: "espacoso",
  radius: 16,
  sidebar: "gradiente",
  nickname: "",
  motion: "system",
  tutorPace: "calm",
};

export const PREFS_COOKIE = "gw_ui";

export const ACCENT_CHOICES = ["auto", "#2A5CD6", "#2440CC", "#6A53CC", "#D2382B"] as const;
export const RADIUS_CHOICES = [10, 16, 22] as const;

interface Theme {
  label: string;
  brand: string;
  brand2: string;
  accent: string;
  sidebar: string;
  sidebarSolid: string;
  bg: string;
  panel: string;
  card: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  ringGlow: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  marinho: {
    label: "Marinho Clássico",
    brand: "#16204E",
    brand2: "#27336E",
    accent: "#2A5CD6",
    sidebar: "linear-gradient(190deg,#1A2660 0%,#141C46 100%)",
    sidebarSolid: "#16204E",
    bg: "#F2F4FB",
    panel: "#FBFCFE",
    card: "#FFFFFF",
    // muted escurecido p/ WCAG AA (mockup usava #8A93B5).
    ink: "#131A38",
    ink2: "#49527A",
    muted: "#646D96",
    line: "#E6E9F5",
    ringGlow: "rgba(42,92,214,.35)",
  },
  royal: {
    label: "Azul Royal",
    brand: "#2440CC",
    brand2: "#3C5BF2",
    accent: "#2A47DB",
    sidebar: "linear-gradient(195deg,#2C49E0 0%,#1E2FAE 100%)",
    sidebarSolid: "#2440CC",
    bg: "#F1F4FD",
    panel: "#FAFBFF",
    card: "#FFFFFF",
    ink: "#15214F",
    ink2: "#4A547F",
    muted: "#646D96",
    line: "#E5E9F8",
    ringGlow: "rgba(42,71,219,.38)",
  },
  premium: {
    label: "Premium",
    brand: "#0E1330",
    brand2: "#1A2148",
    accent: "#2F5AD0",
    sidebar: "linear-gradient(200deg,#141A3C 0%,#0B1026 100%)",
    sidebarSolid: "#0E1330",
    bg: "#F4F2EC",
    panel: "#FBFAF6",
    card: "#FFFFFF",
    ink: "#16193A",
    ink2: "#4C4F6B",
    muted: "#6E6A62",
    line: "#E9E5DA",
    ringGlow: "rgba(47,90,208,.30)",
  },
};

const SEM = {
  danger: "#D2382B",
  success: "#1C9C6B",
  amber: "#C98A12",
  violet: "#6A53CC",
  // tons "soft" (fundo) — emitidos junto p/ nunca dessincronizar da base.
  dangerSoft: "#FCEDEB",
  successSoft: "#E7F5EF",
  amberSoft: "#FBF1DC",
  violetSoft: "#EEEBFA",
};
const DENSITY: Record<DensityId, { pad: number; gap: number; cardPad: number; statPad: number }> = {
  espacoso: { pad: 32, gap: 22, cardPad: 24, statPad: 22 },
  compacto: { pad: 22, gap: 14, cardPad: 18, statPad: 16 },
};

/** Normaliza prefs vindas de fonte não confiável (cookie/DB) para valores válidos. */
export function normalizePrefs(raw: unknown): UiPrefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<UiPrefs>;
  // hasOwnProperty (não `in`): `in` percorre o protótipo e aceitaria "__proto__"/"toString".
  const theme: ThemeId =
    typeof p.theme === "string" && Object.prototype.hasOwnProperty.call(THEMES, p.theme)
      ? (p.theme as ThemeId)
      : DEFAULT_PREFS.theme;
  const density: DensityId = p.density === "compacto" ? "compacto" : "espacoso";
  const sidebar: SidebarId = p.sidebar === "solida" ? "solida" : "gradiente";
  const radius = RADIUS_CHOICES.includes(p.radius as 10) ? (p.radius as number) : DEFAULT_PREFS.radius;
  const accent =
    typeof p.accent === "string" && ACCENT_CHOICES.some((c) => c.toLowerCase() === p.accent!.toLowerCase())
      ? p.accent.toUpperCase().replace("AUTO", "auto")
      : DEFAULT_PREFS.accent;
  const nickname =
    typeof p.nickname === "string" && p.nickname.trim().length <= 30 && !/[<>\p{Cc}\p{Cf}]/u.test(p.nickname)
      ? p.nickname.trim()
      : "";
  const motion = p.motion === "reduced" ? "reduced" : "system";
  const tutorPace = p.tutorPace === "quick" || p.tutorPace === "instant" ? p.tutorPace : "calm";
  return { theme, accent, density, radius, sidebar, nickname, motion, tutorPace };
}

/** Gera o mapa de CSS vars (chave → valor) para aplicar inline no <html>. */
export function themeVars(prefs: UiPrefs): Record<string, string> {
  const th = THEMES[prefs.theme] ?? THEMES[DEFAULT_PREFS.theme]; // defensivo: nunca undefined
  const accent = prefs.accent && prefs.accent !== "auto" ? prefs.accent : th.accent;
  const d = DENSITY[prefs.density];
  const r = prefs.radius;
  return {
    "--brand": th.brand,
    "--brand-2": th.brand2,
    "--accent": accent,
    "--accent-soft": accent + "1A",
    "--sidebar": prefs.sidebar === "solida" ? th.sidebarSolid : th.sidebar,
    "--bg": th.bg,
    "--panel": th.panel,
    "--card": th.card,
    "--ink": th.ink,
    "--ink-2": th.ink2,
    "--muted": th.muted,
    "--line": th.line,
    "--ring-glow": th.ringGlow,
    "--danger": SEM.danger,
    "--danger-soft": SEM.dangerSoft,
    "--success": SEM.success,
    "--success-soft": SEM.successSoft,
    "--amber": SEM.amber,
    "--amber-soft": SEM.amberSoft,
    "--violet": SEM.violet,
    "--violet-soft": SEM.violetSoft,
    "--pad": d.pad + "px",
    "--gap": d.gap + "px",
    "--card-pad": d.cardPad + "px",
    "--stat-pad": d.statPad + "px",
    "--r": r + "px",
    "--r-sm": Math.max(6, r - 6) + "px",
    "--r-lg": r + 6 + "px",
  };
}

/** Serializa/parse do cookie (JSON compacto). */
export function parsePrefsCookie(value: string | undefined): UiPrefs {
  if (!value) return DEFAULT_PREFS;
  try {
    return normalizePrefs(JSON.parse(decodeURIComponent(value)));
  } catch {
    return DEFAULT_PREFS;
  }
}
