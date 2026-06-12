import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as enrollPOST } from "@/app/api/enrollments/route";
import { POST as salaryPOST } from "@/app/api/salary-payments/route";
import { PUT as txPUT, DELETE as txDELETE } from "@/app/api/financial/[id]/route";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

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

beforeEach(() => {
  mockSession.mockResolvedValue(adminSession as any);
  // $transaction interativo: executa o callback contra o próprio mock do prisma.
  (mockPrisma.$transaction as any).mockImplementation((cb: any) => cb(mockPrisma));
  (mockPrisma.auditLog.create as any).mockResolvedValue({});
});

describe("POST /api/enrollments — auto-Payment", () => {
  it("cria matrícula + Payment PENDENTE com valor em centavos (price - discount)", async () => {
    (mockPrisma.plan.findUnique as any).mockResolvedValueOnce({ id: "p1", name: "Basic", price: 39700 });
    (mockPrisma.enrollment.create as any).mockResolvedValueOnce({ id: "en1", student: {}, plan: {} });
    (mockPrisma.payment.create as any).mockResolvedValueOnce({});

    const res = await enrollPOST(
      req("http://localhost/api/enrollments", "POST", {
        studentId: "s1",
        planId: "p1",
        startDate: "2026-06-01",
        discount: 50, // R$ 50 → 5000 centavos
      })
    );

    expect(res.status).toBe(201);
    const paymentArg = (mockPrisma.payment.create as any).mock.calls[0][0].data;
    expect(paymentArg.amount).toBe(34700); // 39700 - 5000
    expect(paymentArg.status).toBe("PENDING");
    expect(paymentArg.month).toBe(6);
    expect(paymentArg.year).toBe(2026);
  });

  it("rejeita desconto maior que o valor do plano (400)", async () => {
    (mockPrisma.plan.findUnique as any).mockResolvedValueOnce({ id: "p1", name: "Basic", price: 39700 });

    const res = await enrollPOST(
      req("http://localhost/api/enrollments", "POST", {
        studentId: "s1",
        planId: "p1",
        startDate: "2026-06-01",
        discount: 500, // R$ 500 → 50000 > 39700
      })
    );

    expect(res.status).toBe(400);
  });

  it("retorna 404 quando o plano não existe", async () => {
    (mockPrisma.plan.findUnique as any).mockResolvedValueOnce(null);

    const res = await enrollPOST(
      req("http://localhost/api/enrollments", "POST", { studentId: "s1", planId: "x", startDate: "2026-06-01" })
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/salary-payments", () => {
  const cltEmployee = { id: "e1", name: "Maria", salary: 300000, dependents: 0, contractType: "CLT" };

  it("CLT: calcula breakdown server-side e gera 2 despesas (líquido + encargos)", async () => {
    (mockPrisma.employee.findUnique as any).mockResolvedValueOnce(cltEmployee);
    (mockPrisma.salaryPayment.create as any).mockResolvedValueOnce({ id: "sp1" });
    (mockPrisma.financialTransaction.create as any).mockResolvedValue({});

    const res = await salaryPOST(
      req("http://localhost/api/salary-payments", "POST", {
        employeeId: "e1",
        month: 6,
        year: 2026,
        type: "SALARY",
        grossAmount: 3000, // R$ 3.000 bruto
      })
    );

    expect(res.status).toBe(201);
    const spArg = (mockPrisma.salaryPayment.create as any).mock.calls[0][0].data;
    expect(spArg.grossAmount).toBe(300000);
    expect(spArg.inssAmount).toBe(25341);
    expect(spArg.amount).toBe(274659); // líquido

    const txCalls = (mockPrisma.financialTransaction.create as any).mock.calls;
    expect(txCalls.length).toBe(2);
    expect(txCalls[0][0].data.amount).toBe(274659); // líquido
    expect(txCalls[0][0].data.reference).toBe("salary:sp1");
    expect(txCalls[1][0].data.amount).toBe(25341 + 0 + 24000); // INSS+IRRF+FGTS
    expect(txCalls[1][0].data.reference).toBe("salary-charges:sp1");
  });

  it("PJ: sem encargos → 1 despesa só, líquido = bruto", async () => {
    (mockPrisma.employee.findUnique as any).mockResolvedValueOnce({ ...cltEmployee, contractType: "PJ" });
    (mockPrisma.salaryPayment.create as any).mockResolvedValueOnce({ id: "sp2" });
    (mockPrisma.financialTransaction.create as any).mockResolvedValue({});

    const res = await salaryPOST(
      req("http://localhost/api/salary-payments", "POST", { employeeId: "e1", month: 6, year: 2026, grossAmount: 3000 })
    );

    expect(res.status).toBe(201);
    const txCalls = (mockPrisma.financialTransaction.create as any).mock.calls;
    expect(txCalls.length).toBe(1);
    expect(txCalls[0][0].data.amount).toBe(300000);
  });

  it("sem grossAmount usa o salário cadastrado", async () => {
    (mockPrisma.employee.findUnique as any).mockResolvedValueOnce({ ...cltEmployee, salary: 151800 });
    (mockPrisma.salaryPayment.create as any).mockResolvedValueOnce({ id: "sp3" });
    (mockPrisma.financialTransaction.create as any).mockResolvedValue({});

    const res = await salaryPOST(
      req("http://localhost/api/salary-payments", "POST", { employeeId: "e1", month: 6, year: 2026 })
    );

    expect(res.status).toBe(201);
    const spArg = (mockPrisma.salaryPayment.create as any).mock.calls[0][0].data;
    expect(spArg.grossAmount).toBe(151800);
    expect(spArg.inssAmount).toBe(11385); // 7,5% do mínimo
  });

  it("retorna 404 quando o funcionário não existe", async () => {
    (mockPrisma.employee.findUnique as any).mockResolvedValueOnce(null);

    const res = await salaryPOST(
      req("http://localhost/api/salary-payments", "POST", { employeeId: "x", month: 6, year: 2026, grossAmount: 3000 })
    );

    expect(res.status).toBe(404);
  });
});

describe("financial/[id] — editar/excluir", () => {
  const ctx = { params: Promise.resolve({ id: "t1" }) };

  it("PUT atualiza valor em centavos", async () => {
    (mockPrisma.financialTransaction.findUnique as any).mockResolvedValueOnce({ id: "t1", paidAt: null });
    (mockPrisma.financialTransaction.update as any).mockResolvedValueOnce({ id: "t1" });

    const res = await txPUT(req("http://localhost/api/financial/t1", "PUT", { amount: 100 }), ctx as any);

    expect(res.status).toBe(200);
    const updateArg = (mockPrisma.financialTransaction.update as any).mock.calls[0][0].data;
    expect(updateArg.amount).toBe(10000); // R$ 100 → 10000 centavos
  });

  it("PUT em transação inexistente → 404", async () => {
    (mockPrisma.financialTransaction.findUnique as any).mockResolvedValueOnce(null);

    const res = await txPUT(req("http://localhost/api/financial/t1", "PUT", { amount: 100 }), ctx as any);
    expect(res.status).toBe(404);
  });

  it("DELETE remove a transação", async () => {
    (mockPrisma.financialTransaction.delete as any).mockResolvedValueOnce({ id: "t1" });

    const res = await txDELETE(req("http://localhost/api/financial/t1", "DELETE"), ctx as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.financialTransaction.delete).toHaveBeenCalled();
  });
});
