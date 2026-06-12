"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export function TransactionActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Excluir esta transação? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    const res = await fetch(`/api/financial/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? "Erro ao excluir.");
      setDeleting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
      <Link href={`/admin/financial/${id}/edit`}>
        <Button variant="ghost" size="icon" title="Editar"><Pencil size={15} /></Button>
      </Link>
      <Button variant="ghost" size="icon" title="Excluir" onClick={handleDelete} disabled={deleting}>
        <Trash2 size={15} color="var(--danger)" />
      </Button>
    </div>
  );
}
