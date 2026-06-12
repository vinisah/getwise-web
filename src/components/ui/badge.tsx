import * as React from "react";
import { cx } from "@/lib/utils";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const toneMap: Record<Variant, { bg: string; fg: string }> = {
  default: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  secondary: { bg: "#EEF1F8", fg: "var(--ink-2)" },
  destructive: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  outline: { bg: "transparent", fg: "var(--ink-2)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--amber-soft)", fg: "var(--amber)" },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

function Badge({ className, variant = "default", style, ...props }: BadgeProps) {
  const t = toneMap[variant];
  return (
    <span
      className={cx(className)}
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
        border: variant === "outline" ? "1px solid var(--line)" : "none",
        ...style,
      }}
      {...props}
    />
  );
}

export { Badge };
