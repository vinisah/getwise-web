"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";

/** Arquiva (isActive=false) ou restaura (true) o curso — soft-delete preserva histórico. */
export function CourseArchiveButton({ courseId, isActive }: { courseId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" disabled={loading} onClick={toggle} title={isActive ? "Arquivar curso" : "Restaurar curso"}>
      {isActive ? (
        <><Archive size={15} /> Arquivar</>
      ) : (
        <><ArchiveRestore size={15} color="var(--success)" /> Restaurar</>
      )}
    </Button>
  );
}
