"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Lock } from "lucide-react";

/**
 * Player de vídeo com tracking de progresso (real-time).
 * - Salva posição a cada 5s e no beforeunload (edge case: fechar navegador)
 * - Retoma da última posição (resume)
 * - Libera exercícios quando assistido >= 90%
 */
export function VideoPlayer({
  unitId,
  videoUrl,
  initialPosition,
  initialPercent,
  onUnlock,
}: {
  unitId: string;
  videoUrl: string;
  initialPosition: number;
  initialPercent: number;
  onUnlock?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [percent, setPercent] = useState(initialPercent);
  const lastSent = useRef(0);
  const unlockedRef = useRef(initialPercent >= 90);

  async function save(positionSeconds: number, watchedPercent: number) {
    try {
      const res = await fetch(`/api/units/${unitId}/video-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionSeconds: Math.floor(positionSeconds), watchedPercent: Math.floor(watchedPercent) }),
        keepalive: true,
      });
      const data = await res.json();
      if (data.watchedPercent >= 90 && !unlockedRef.current) {
        unlockedRef.current = true;
        onUnlock?.();
      }
    } catch {
      /* offline — tentará no próximo tick */
    }
  }

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Resume
    if (initialPosition > 0) v.currentTime = initialPosition;

    function onTime() {
      if (!v || !v.duration) return;
      const pct = (v.currentTime / v.duration) * 100;
      setPercent(pct);
      const now = Date.now();
      if (now - lastSent.current > 5000) {
        lastSent.current = now;
        save(v.currentTime, pct);
      }
    }
    function onUnload() {
      if (v && v.duration) {
        const pct = (v.currentTime / v.duration) * 100;
        save(v.currentTime, pct);
      }
    }
    v.addEventListener("timeupdate", onTime);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      window.removeEventListener("beforeunload", onUnload);
      onUnload(); // salva ao desmontar
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, unitId]);

  const unlocked = percent >= 90;

  return (
    <div>
      <video ref={ref} src={videoUrl} controls style={{ width: "100%", borderRadius: "var(--r-sm)", background: "#000" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <div className="gw-meter" style={{ flex: 1 }}>
          <span style={{ width: `${Math.min(100, percent)}%`, background: unlocked ? "var(--success)" : "var(--accent)" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: unlocked ? "var(--success)" : "var(--ink-2)", display: "flex", alignItems: "center", gap: 5 }}>
          {unlocked ? <><CheckCircle size={15} /> Liberado</> : <><Lock size={14} /> {Math.floor(percent)}% / 90%</>}
        </span>
      </div>
    </div>
  );
}
