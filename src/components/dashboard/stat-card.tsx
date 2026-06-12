import { type LucideIcon } from "lucide-react";
import { Delta, TONES } from "@/components/gw/primitives";
import { Sparkline } from "@/components/gw/charts";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: string;
  delta?: number;
  spark?: number[];
}

const TONE_HEX: Record<string, string> = {
  blue: "#2A5CD6",
  green: "#1C9C6B",
  red: "#D2382B",
  amber: "#C98A12",
  violet: "#6A53CC",
  slate: "#49527A",
};

export function StatCard({ label, value, sub, icon: Icon, tone = "blue", delta, spark }: StatCardProps) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className="gw-card gw-stat" style={{ padding: "var(--stat-pad)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "var(--r-sm)",
            background: t.bg,
            color: t.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={21} strokeWidth={1.9} />
        </div>
        {delta != null && <Delta value={delta} />}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, letterSpacing: ".01em" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4 }}>{sub}</div>}
      </div>
      {spark && <Sparkline data={spark} color={TONE_HEX[tone] || "#2A5CD6"} />}
    </div>
  );
}
