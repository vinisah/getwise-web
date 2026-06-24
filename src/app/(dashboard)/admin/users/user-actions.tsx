"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserX, UserCheck, KeyRound } from "lucide-react";

/** Ações de gestão: trocar role, perfil de acesso, ativar/desativar, senha temporária. */
export function UserActions({
  userId,
  role,
  isActive,
  isSelf,
  profileId,
  profiles,
}: {
  userId: string;
  role: string;
  isActive: boolean;
  isSelf: boolean;
  profileId?: string | null;
  profiles?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro.");
      return false;
    }
    router.refresh();
    return true;
  }

  if (pwOpen) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const pw = new FormData(e.currentTarget).get("password") as string;
          if (await patch({ password: pw })) setPwOpen(false);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6, minWidth: 180, textAlign: "left" }}
      >
        <Label htmlFor={`pw-${userId}`} className="text-xs">
          Senha temporária (mín. 6)
        </Label>
        <Input id={`pw-${userId}`} name="password" type="text" minLength={6} required placeholder="nova senha" />
        {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
        <div style={{ display: "flex", gap: 6 }}>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "..." : "Definir"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPwOpen(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select
        defaultValue={role}
        disabled={isSelf || loading}
        title={isSelf ? "Você não pode trocar o próprio papel" : "Trocar papel"}
        onChange={(e) => patch({ role: e.target.value })}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="ADMIN">Admin</option>
        <option value="TEACHER">Professor</option>
        <option value="STUDENT">Aluno</option>
      </select>
      {role === "ADMIN" && profiles && (
        <select
          defaultValue={profileId ?? ""}
          disabled={isSelf || loading}
          title={isSelf ? "Você não pode aplicar perfil a si mesmo" : "Perfil de acesso (limita seções)"}
          onChange={(e) => patch({ profileId: e.target.value || null })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Dono (tudo)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <Button variant="ghost" size="sm" onClick={() => setPwOpen(true)} title="Definir senha temporária">
        <KeyRound size={14} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={isSelf || loading}
        title={isSelf ? "Você não pode desativar a si mesmo" : isActive ? "Desativar (bloqueia login)" : "Reativar"}
        onClick={() => patch({ isActive: !isActive })}
      >
        {isActive ? <UserX size={14} color="var(--danger)" /> : <UserCheck size={14} color="var(--success)" />}
      </Button>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
