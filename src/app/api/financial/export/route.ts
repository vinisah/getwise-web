import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { MonthYearQuerySchema } from "@/lib/schemas";
import { monthRangeBrasilia } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX", CREDIT_CARD: "Cartao de credito", DEBIT_CARD: "Cartao de debito", BOLETO: "Boleto",
};

/** Centavos → "1234,56" (decimal brasileiro, sem milhar — Excel BR entende). */
const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Escapa campo CSV (separador ;). */
const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * GET /api/financial/export?month=&year= — CSV das transações p/ o contador.
 * Sem month: exporta o ano inteiro. Separador ; e BOM UTF-8 (Excel BR).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const parsed = MonthYearQuerySchema.safeParse({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
  }

  const now = new Date();
  const year = parsed.data.year ?? now.getFullYear();
  const month = parsed.data.month;

  const range = month
    ? monthRangeBrasilia(year, month)
    : { gte: monthRangeBrasilia(year, 1).gte, lte: monthRangeBrasilia(year, 12).lte };

  const transactions = await prisma.financialTransaction.findMany({
    where: { date: { gte: range.gte, lte: range.lte } },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const header = "data;descricao;categoria;tipo;valor;status;forma_pagamento;referencia";
  const rows = transactions.map((t) =>
    [
      t.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      esc(t.description),
      esc(t.category?.name ?? ""),
      t.type === "INCOME" ? "Receita" : "Despesa",
      csvMoney(t.amount),
      t.isPaid ? "Pago" : "Pendente",
      t.paymentMethod ? METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod : "",
      esc(t.reference ?? ""),
    ].join(";")
  );

  // BOM faz o Excel abrir como UTF-8 (acentos corretos).
  const csv = "﻿" + [header, ...rows].join("\r\n");
  const filename = month ? `financeiro-${String(month).padStart(2, "0")}-${year}.csv` : `financeiro-${year}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
