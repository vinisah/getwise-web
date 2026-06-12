import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cx } from "@/lib/utils";

type Variant = "default" | "accent" | "outline" | "ghost" | "destructive" | "success" | "secondary" | "link";
type Size = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const variantStyle: Record<Variant, React.CSSProperties> = {
  default: { background: "var(--brand)", color: "#fff", boxShadow: "0 1px 2px rgba(16,22,48,.18)" },
  accent: { background: "var(--accent)", color: "#fff", boxShadow: "0 6px 16px -6px var(--ring-glow)" },
  outline: { background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" },
  ghost: { background: "transparent", color: "var(--ink-2)" },
  destructive: { background: "var(--danger-soft)", color: "var(--danger)" },
  success: { background: "var(--success)", color: "#fff" },
  secondary: { background: "#EEF1F8", color: "var(--ink-2)" },
  link: { background: "transparent", color: "var(--accent)", textDecoration: "underline", boxShadow: "none" },
};

const sizeStyle: Record<Size, React.CSSProperties> = {
  default: { fontSize: 14, padding: "11px 17px" },
  sm: { fontSize: 13, padding: "8px 13px" },
  lg: { fontSize: 15, padding: "13px 22px" },
  icon: { width: 40, height: 40, padding: 0 },
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontFamily: "var(--sans)",
      fontWeight: 600,
      cursor: "pointer",
      border: "1px solid transparent",
      borderRadius: "var(--r-sm)",
      whiteSpace: "nowrap",
      lineHeight: 1,
    };
    return (
      <Comp
        ref={ref as never}
        className={cx("gw-btn", className)}
        style={{ ...base, ...sizeStyle[size], ...variantStyle[variant], ...style }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
