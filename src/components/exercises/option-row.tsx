import { cx } from "@/lib/utils";
import styles from "./practice.module.css";

/** Shared answer target for practice and course exercises. */
export function OptionRow({
  label,
  selected,
  disabled,
  onClick,
  grow,
  letter,
  state,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  grow?: boolean;
  letter?: string;
  state?: "correct" | "incorrect" | "muted";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={letter ? `${letter}. ${label}` : undefined}
      onClick={onClick}
      className={cx(styles.option, selected && styles.selected, state && styles[state], grow && styles.grow)}
    >
      {letter && <span className={styles.letter}>{letter}.</span>}
      <span>{label}</span>
    </button>
  );
}
