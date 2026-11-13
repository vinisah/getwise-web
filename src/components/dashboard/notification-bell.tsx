"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Sino de notificações: badge de não lidas + dropdown com lista, marcar lida e navegar. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const d = await res.json();
      setItems(Array.isArray(d?.items) ? d.items : []);
      setUnread(typeof d?.unread === "number" ? d.unread : 0);
    } catch {
      /* silencioso — sino é secundário */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    setUnread(0);
    setItems((it) => it.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    // Falha → reconcilia com o servidor (não deixa estado otimista mentiroso).
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => load());
  }

  function openItem(n: Notif) {
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => load());
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        className="gw-icon-btn"
        title="Notificações"
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
      >
        <Bell size={19} />
        {unread > 0 && <span className="gw-badge-dot" />}
      </button>
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        label="Notificações"
        placement="notifications"
        anchorRef={triggerRef}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--line)",
            position: "sticky",
            top: 0,
            background: "var(--card)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Notificações</span>
          {unread > 0 && (
            <button
              onClick={markAll}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--accent)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Marcar todas
            </button>
          )}
          <button
            type="button"
            className="gw-icon-btn sm"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", padding: "20px 14px", textAlign: "center" }}>
            Sem notificações.
          </p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className="gw-cmd-item"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                borderBottom: "1px solid var(--line)",
                background: n.readAt ? "transparent" : "var(--accent-soft)",
                cursor: "pointer",
                padding: "11px 14px",
              }}
            >
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{n.title}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.body}</span>
            </button>
          ))
        )}
      </AppDialog>
    </div>
  );
}
