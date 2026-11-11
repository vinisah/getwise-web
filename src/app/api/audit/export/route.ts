import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { AUDIT_FILTERS } from "@/lib/audit-filters";
import { prisma } from "@/lib/prisma";

/**
 * Escapa campo CSV (separador ;) e neutraliza CSV formula injection.
 * Excel/LibreOffice executa células iniciadas por = + - @ (ou tab/CR) como fórmula —
 * prefixa com ' (apóstrofo) para forçar texto.
 */
const esc = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * GET /api/audit/export?filter= — CSV da trilha de auditoria (admin-only).
 * Separador ; e BOM UTF-8 (Excel BR). Mesmo agrupamento de filtros da tela.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("audit");

  const { searchParams } = new URL(req.url);
  const fk = searchParams.get("filter");
  const actions = fk && fk in AUDIT_FILTERS ? AUDIT_FILTERS[fk].actions : undefined;

  const logs = await prisma.auditLog.findMany({
    where: actions ? { action: { in: actions } } : {},
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? id.slice(-6)) : "sistema");

  const header = "quando;quem;acao;entidade;id_entidade;detalhes";
  const rows = logs.map((l) =>
    [
      l.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      esc(nameOf(l.userId)),
      esc(l.action),
      esc(l.entity ?? ""),
      esc(l.entityId ?? ""),
      esc(l.payload ? JSON.stringify(l.payload) : ""),
    ].join(";")
  );

  const csv = "﻿" + [header, ...rows].join("\r\n");
  const suffix = fk && fk !== "ALL" ? `-${fk.toLowerCase()}` : "";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria${suffix}.csv"`,
    },
  });
});
