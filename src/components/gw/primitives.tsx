import { cx } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--mono)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: "var(--muted)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{title}</h3>
        {sub && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const TONES: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  green: { bg: "var(--success-soft)", fg: "var(--success)" },
  red: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  amber: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  violet: { bg: "var(--violet-soft)", fg: "var(--violet)" },
  slate: { bg: "#EEF1F8", fg: "var(--ink-2)" },
};

export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 12.5,
        fontWeight: 700,
        color: up ? "var(--success)" : "var(--danger)",
      }}
    >
      {up ? <TrendingUp size={14} strokeWidth={2.1} /> : <TrendingDown size={14} strokeWidth={2.1} />}
      {up ? "+" : ""}
      {value}%{suffix}
    </span>
  );
}

export function Legend({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, border: border ? "1px solid var(--line)" : "none" }} />
      {label}
    </span>
  );
}

export function MiniStat({ value, label, tone = "blue" }: { value: string; label: string; tone?: string }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div style={{ background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "12px 14px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.fg, letterSpacing: "-.02em" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>{label}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
  dot,
  style,
}: {
  children: React.ReactNode;
  tone?: string;
  dot?: boolean;
  style?: React.CSSProperties;
}) {
  const t = TONES[tone] || TONES.slate;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 12,
        fontWeight: 600,
        ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.fg }} />}
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  size = 38,
  tone = "seed",
}: {
  initials: string;
  size?: number;
  tone?: "brand" | "seed";
}) {
  const palette = ["#2A5CD6", "#1C9C6B", "#C98A12", "#6A53CC", "#D2382B", "#16204E"];
  let hash = 0;
  for (const c of initials || "") hash = (hash + c.charCodeAt(0)) % palette.length;
  const bg = tone === "brand" ? "var(--brand)" : palette[hash];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        flexShrink: 0,
        background: bg,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.36,
        letterSpacing: ".02em",
      }}
    >
      {initials}
    </div>
  );
}

export function Card({
  children,
  style,
  pad = true,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return (
    <div className={cx("gw-card", className)} style={{ padding: pad ? "var(--card-pad)" : 0, ...style }} {...rest}>
      {children}
    </div>
  );
}
