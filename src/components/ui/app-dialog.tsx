"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/utils";
import styles from "./app-dialog.module.css";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  placement?: "search" | "drawer" | "navigation" | "notifications";
  anchorRef?: RefObject<HTMLElement | null>;
  className?: string;
};

/** Top-layer overlay: shared viewport bounds, native focus trap and focus restoration. */
export function AppDialog(props: DialogProps) {
  return props.open ? <OpenDialog {...props} /> : null;
}

function OpenDialog({ onClose, label, children, placement = "search", anchorRef, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    const viewport = window.visualViewport;
    const position = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      dialog.style.setProperty("--visible-height", `${height}px`);
      dialog.style.setProperty("--visible-top", `${offset}px`);
      if (anchorRef?.current) {
        const anchor = anchorRef.current.getBoundingClientRect();
        const width = Math.min(340, window.innerWidth - 32);
        const top = Math.max(offset + 16, Math.min(anchor.bottom + 8, offset + height - 220));
        dialog.style.setProperty(
          "--anchor-left",
          `${Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16))}px`
        );
        dialog.style.setProperty("--anchor-top", `${top}px`);
        dialog.style.setProperty("--anchor-height", `${Math.max(120, offset + height - top - 16)}px`);
      }
    };
    position();
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("resize", position);
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [anchorRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      aria-modal="true"
      className={cx(styles.surface, styles[placement], className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        pressedBackdrop.current =
          event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
    >
      {children}
    </dialog>,
    document.body
  );
}
