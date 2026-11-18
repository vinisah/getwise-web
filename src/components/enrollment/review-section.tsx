import type { ReactNode } from "react";
import s from "./enrollment.module.css";

/** Native disclosure keeps fields mounted and keyboard navigation predictable. */
export function ReviewSection({
  title,
  children,
  initiallyOpen = false,
  collapsible = true,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
  collapsible?: boolean;
}) {
  if (!collapsible)
    return (
      <section className={s.card}>
        <h2>{title}</h2>
        {children}
      </section>
    );
  return (
    <details className={s.reviewSection} open={initiallyOpen}>
      <summary>{title}</summary>
      <div className={s.reviewContent}>{children}</div>
    </details>
  );
}

export function revealField(id: string) {
  const field = document.getElementById(id);
  let parent = field?.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  field?.focus();
}
