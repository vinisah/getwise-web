"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TONES } from "./primitives";

export function QuickAction({
  icon,
  tone,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  desc: string;
  href: string;
}) {
  const t = TONES[tone] || TONES.blue;
  return (
    <Link className="gw-card gw-quick" href={href}>
      <div style={{ width: 46, height: 46, borderRadius: "var(--r-sm)", background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{desc}</div>
      </div>
      <ArrowRight size={18} color="var(--muted)" />
    </Link>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 3, gap: 2 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "none",
              cursor: "pointer",
              padding: size === "sm" ? "6px 12px" : "8px 15px",
              borderRadius: "calc(var(--r-sm) - 3px)",
              fontFamily: "var(--sans)",
              fontSize: 13,
              fontWeight: 600,
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--ink)" : "var(--muted)",
              boxShadow: active ? "0 1px 3px rgba(16,22,48,.12)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
