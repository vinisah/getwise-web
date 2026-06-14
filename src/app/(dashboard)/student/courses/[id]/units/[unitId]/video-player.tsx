"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Detecta o tipo de vídeo a partir da URL.
 * - youtube/vimeo → embed via iframe (sem tracking nativo → conclusão manual)
 * - arquivo direto (mp4/webm/... ou Blob da Vercel) → <video> com tracking de 90%
 * - outro → iframe genérico (best-effort) + conclusão manual
 */
function detectVideo(url: string): { kind: "file" | "embed"; src: string } {
  // YouTube: youtu.be/ID, /embed/ID, /shorts/ID, watch?v=ID (inclusive com &list etc.)
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) {
    const id = url.match(/(?:youtu\.be\/|\/embed\/|\/shorts\/|[?&]v=)([\w-]{11})/);
    if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id[1]}` };
  }
  // Vimeo: vimeo.com/123 ou /video/123 (+ hash de não-listado /123/abcdef → ?h=hash)
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/);
  if (vm) return { kind: "embed", src: `https://player.vimeo.com/video/${vm[1]}${vm[2] ? `?h=${vm[2]}` : ""}` };
  if (/\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) || /\.blob\.vercel-storage\.com\//.test(url)) {
    return { kind: "file", src: url };
  }
  return { kind: "embed", src: url }; // genérico: tenta exibir no iframe
}

/**
 * Player de vídeo com tracking de progresso.
 * Arquivo direto/upload: salva posição a cada 5s + retoma + libera a 90% automaticamente.
 * Embed (YouTube/Vimeo/iframe): libera por confirmação manual ("marquei que assisti").
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
  const router = useRouter();
  const ref = useRef<HTMLVideoElement>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [saving, setSaving] = useState(false);
  const lastSent = useRef(0);
  const unlockedRef = useRef(initialPercent >= 90);

  const video = detectVideo(videoUrl);

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
        // Re-renderiza o server component (libera o painel de exercícios sem reload manual).
        router.refresh();
      }
      return data.watchedPercent as number;
    } catch {
      return undefined; // offline — tenta no próximo tick
    }
  }

  // Tracking nativo só faz sentido para arquivo direto/upload.
  useEffect(() => {
    if (video.kind !== "file") return;
    const v = ref.current;
    if (!v) return;
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
      if (v && v.duration) save(v.currentTime, (v.currentTime / v.duration) * 100);
    }
    v.addEventListener("timeupdate", onTime);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      window.removeEventListener("beforeunload", onUnload);
      onUnload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, unitId, video.kind]);

  const unlocked = percent >= 90;

  async function confirmWatched() {
    setSaving(true);
    const pct = await save(0, 100);
    setSaving(false);
    if (pct !== undefined) setPercent(pct);
    else setPercent(100);
  }

  return (
    <div>
      {video.kind === "file" ? (
        <video ref={ref} src={video.src} controls style={{ width: "100%", borderRadius: "var(--r-sm)", background: "#000" }} />
      ) : (
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--r-sm)", overflow: "hidden", background: "#000" }}>
          <iframe
            src={video.src}
            title="Vídeo da unidade"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div className="gw-meter" style={{ flex: 1, minWidth: 160 }}>
          <span style={{ width: `${Math.min(100, percent)}%`, background: unlocked ? "var(--success)" : "var(--accent)" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: unlocked ? "var(--success)" : "var(--ink-2)", display: "flex", alignItems: "center", gap: 5 }}>
          {unlocked ? <><CheckCircle size={15} /> Liberado</> : <><Lock size={14} /> {Math.floor(percent)}% / 90%</>}
        </span>
        {video.kind === "embed" && !unlocked && (
          <Button size="sm" variant="outline" disabled={saving} onClick={confirmWatched}>
            {saving ? "..." : "Marquei que assisti"}
          </Button>
        )}
      </div>
    </div>
  );
}
