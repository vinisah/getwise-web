import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { PATCH as paymentPATCH } from "@/app/api/payments/[id]/route";
import { POST as recurringPOST } from "@/app/api/financial/recurring/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const P2002 = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" });

const mockSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

const adminSession = { user: { id: "admin-1", name: "Admin", email: "a@a.com", role: "ADMIN" as const } };

function req(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const basePayment = {
  id: "pay1",
  amount: 34700,
  month: 6,
  year: 2026,
  status: "PENDING",
  // vence amanhã → sem multa/juros
  dueDate: new Date(Date.now() + 86_400_000),
  student: { name: "João" },
};

beforeEach(() => {
  mockSession.mockResolvedValue(adminSession as any);
  // $transaction aceita callback interativo OU array de promises.
  (mockPrisma.$transaction as any).mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma)
  );
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
});

describe("PATCH /api/payments/[id]", () => {
  const ctx = { params: Promise.resolve({ id: "pay1" }) };

  it("PAID cria receita no financeiro com o valor da mensalidade", async () => {
    (mockPrisma.payment.findUnique as any)
      .mockResolvedValueOnce(basePayment)                          // leitura externa (404 check)
      .mockResolvedValueOnce({ ...basePayment, status: "PAID" });  // resultado pós-updateMany
    (mockPrisma.payment.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.financialTransaction.create as any).mockResolvedValueOnce({});

    const res = await paymentPATCH(req("http://localhost/api/payments/pay1", "PATCH", { status: "PAID", method: "PIX" }), ctx as any);

    expect(res.status).toBe(200);
    const txArg = (mockPrisma.financialTransaction.create as any).mock.calls[0][0].data;
    expect(txArg.type).toBe("INCOME");
    expect(txArg.amount).toBe(34700);
    expect(txArg.reference).toBe("payment:pay1");
  });

  it("PAID vencida há 30 dias inclui multa 2% + juros 1%", async () => {
    const overdue = { ...basePayment, dueDate: new Date(Date.now() - 30 * 86_400_000) };
    (mockPrisma.payment.findUnique as any)
      .mockResolvedValueOnce(overdue)
      .mockResolvedValueOnce({ ...overdue, status: "PAID" });
    (mockPrisma.payment.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.financialTransaction.create as any).mockResolvedValueOnce({});

    const res = await paymentPATCH(req("http://localhost/api/payments/pay1", "PATCH", { status: "PAID" }), ctx as any);

    expect(res.status).toBe(200);
    const txArg = (mockPrisma.financialTransaction.create as any).mock.calls[0][0].data;
    // 34700 + multa 694 + juros 347 = 35741
    expect(txArg.amount).toBe(35741);
    expect(txArg.description).toContain("multa e juros");
  });

  it("PAID idempotente: já paga (amountPaid set) → no-op, sem duplicar receita", async () => {
    (mockPrisma.payment.findUnique as any).mockResolvedValueOnce({ ...basePayment, status: "PAID", amountPaid: 34700 });

    const res = await paymentPATCH(req("http://localhost/api/payments/pay1", "PATCH", { status: "PAID" }), ctx as any);

    expect(res.status).toBe(200);
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    expect(mockPrisma.financialTransaction.create).not.toHaveBeenCalled();
  });

  it("PAID idempotente: reference duplicada (P2002) é silenciada", async () => {
    (mockPrisma.payment.findUnique as any)
      .mockResolvedValueOnce(basePayment)
      .mockResolvedValueOnce({ ...basePayment, status: "PAID" });
    (mockPrisma.payment.updateMany as any).mockResolvedValueOnce({ count: 1 });
    (mockPrisma.financialTransaction.create as any).mockRejectedValueOnce(P2002);

    const res = await paymentPATCH(req("http://localhost/api/payments/pay1", "PATCH", { status: "PAID" }), ctx as any);

    expect(res.status).toBe(200); // P2002 capturado, não vira erro
  });

  it("PENDING remove a receita vinculada", async () => {
    (mockPrisma.payment.findUnique as any).mockResolvedValueOnce({ ...basePayment, status: "PAID" });
    (mockPrisma.payment.update as any).mockResolvedValueOnce({ ...basePayment, status: "PENDING" });
    (mockPrisma.financialTransaction.deleteMany as any).mockResolvedValueOnce({ count: 1 });

    const res = await paymentPATCH(req("http://localhost/api/payments/pay1", "PATCH", { status: "PENDING" }), ctx as any);

    expect(res.status).toBe(200);
    expect(mockPrisma.financialTransaction.deleteMany).toHaveBeenCalledWith({ where: { reference: "payment:pay1" } });
  });

  it("404 quando mensalidade não existe", async () => {
    (mockPrisma.payment.findUnique as any).mockResolvedValueOnce(null);
    const res = await paymentPATCH(req("http://localhost/api/payments/x", "PATCH", { status: "PAID" }), ctx as any);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/financial/recurring", () => {
  const recurringTx = {
    id: "src1",
    type: "EXPENSE",
    amount: 150000,
    description: "Aluguel",
    date: new Date(Date.UTC(2026, 4, 5, 3)), // 05/mai
    dueDate: null,
    categoryId: null,
    paymentMethod: null,
    notes: null,
  };

  it("clona recorrentes do mês anterior com reference estável", async () => {
    (mockPrisma.financialTransaction.findMany as any).mockResolvedValueOnce([recurringTx]); // sources (maio)
    (mockPrisma.financialTransaction.create as any).mockResolvedValueOnce({});

    const res = await recurringPOST(req("http://localhost/api/financial/recurring", "POST", { month: 6, year: 2026 }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    const created = (mockPrisma.financialTransaction.create as any).mock.calls[0][0].data;
    expect(created.description).toBe("Aluguel");
    expect(created.isRecurring).toBe(true);
    expect(created.reference).toBe("recurring:src1:06/2026"); // idempotência estável
    expect(created.date.getUTCMonth()).toBe(5); // junho (0-based)
  });

  it("clone-de-clone mantém a raiz na reference (anti-duplicação fora de ordem)", async () => {
    // Fonte do mês anterior é ela mesma um clone gerado: reference = recurring:<raiz>:<MM/AAAA>.
    const clonedSource = { ...recurringTx, id: "clone-mai", reference: "recurring:src1:05/2026" };
    (mockPrisma.financialTransaction.findMany as any).mockResolvedValueOnce([clonedSource]);
    (mockPrisma.financialTransaction.create as any).mockResolvedValueOnce({});

    const res = await recurringPOST(req("http://localhost/api/financial/recurring", "POST", { month: 6, year: 2026 }));
    expect(res.status).toBe(200);
    const created = (mockPrisma.financialTransaction.create as any).mock.calls[0][0].data;
    // Ancorado na RAIZ (src1), não no id do predecessor (clone-mai).
    expect(created.reference).toBe("recurring:src1:06/2026");
  });

  it("dedupe: P2002 (já gerada no mês) → pula, sem duplicar", async () => {
    (mockPrisma.financialTransaction.findMany as any).mockResolvedValueOnce([recurringTx]);
    (mockPrisma.financialTransaction.create as any).mockRejectedValueOnce(P2002); // reference já existe

    const res = await recurringPOST(req("http://localhost/api/financial/recurring", "POST", { month: 6, year: 2026 }));

    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it("400 para mês inválido", async () => {
    const res = await recurringPOST(req("http://localhost/api/financial/recurring", "POST", { month: 13, year: 2026 }));
    expect(res.status).toBe(400);
  });
});
