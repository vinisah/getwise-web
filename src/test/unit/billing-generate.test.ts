import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { __resetBoletoProvider } from "@/lib/billing/provider";
import { generateChargeForPayment, settleChargePaid } from "@/lib/billing/generate";

// Sem env de provedor → Stub (não emite nada real).
const p = prisma as unknown as {
  payment: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  delete process.env.BILLING_PROVIDER;
  delete process.env.ASAAS_API_KEY;
  __resetBoletoProvider();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const basePayment = {
  id: "pay_1",
  status: "PENDING",
  chargeId: null,
  amount: 39700,
  dueDate: new Date("2026-07-10T03:00:00.000Z"),
  description: "Mensalidade 07/2026",
  month: 7,
  year: 2026,
  student: { name: "Aluno", email: "a@x.com", phone: "11999", studentProfile: { cpf: "12345678909" } },
};

describe("generateChargeForPayment", () => {
  it("gera (stub) e grava chargeId quando PENDENTE sem cobrança", async () => {
    p.payment.findUnique.mockResolvedValue(basePayment);
    p.payment.updateMany.mockResolvedValue({ count: 1 });
    const r = await generateChargeForPayment("pay_1");
    expect(r.status).toBe("created");
    expect(r.chargeId).toBe("stub_pay_1");
    expect(p.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay_1", chargeId: null } })
    );
  });

  it("pula se já tem chargeId (idempotente)", async () => {
    p.payment.findUnique.mockResolvedValue({ ...basePayment, chargeId: "stub_pay_1" });
    const r = await generateChargeForPayment("pay_1");
    expect(r.status).toBe("skipped");
    expect(p.payment.updateMany).not.toHaveBeenCalled();
  });

  it("pula se não está PENDENTE", async () => {
    p.payment.findUnique.mockResolvedValue({ ...basePayment, status: "PAID" });
    const r = await generateChargeForPayment("pay_1");
    expect(r.status).toBe("skipped");
  });

  it("pagamento inexistente → error", async () => {
    p.payment.findUnique.mockResolvedValue(null);
    const r = await generateChargeForPayment("nope");
    expect(r.status).toBe("error");
  });

  it("corrida: updateMany count 0 → skipped (não duplica)", async () => {
    p.payment.findUnique.mockResolvedValue(basePayment);
    p.payment.updateMany.mockResolvedValue({ count: 0 });
    const r = await generateChargeForPayment("pay_1");
    expect(r.status).toBe("skipped");
  });
});

describe("settleChargePaid", () => {
  function mockTx(updateCount: number) {
    const tx = {
      payment: { updateMany: vi.fn().mockResolvedValue({ count: updateCount }) },
      financialTransaction: { create: vi.fn().mockResolvedValue({}) },
    };
    p.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    return tx;
  }

  it("dá baixa e cria receita quando ainda não paga (valor cobre o devido)", async () => {
    p.payment.findFirst.mockResolvedValue({ ...basePayment, chargeId: "ch_1" });
    const tx = mockTx(1);
    const r = await settleChargePaid("ch_1", 40692); // 39700 + multa/juros
    expect(r).toMatchObject({ settled: true, found: true, paymentId: "pay_1" });
    expect(tx.financialTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "INCOME", reference: "payment:pay_1", amount: 40692 }),
      })
    );
  });

  it("pagamento PARCIAL (< devido) NÃO marca pago e não cria receita", async () => {
    p.payment.findFirst.mockResolvedValue({ ...basePayment, chargeId: "ch_1" });
    const tx = mockTx(1);
    const r = await settleChargePaid("ch_1", 30000); // < 39700
    expect(r).toMatchObject({ settled: false, found: true });
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
  });

  it("idempotente: já paga (count 0) → settled false, found true, sem receita", async () => {
    p.payment.findFirst.mockResolvedValue({ ...basePayment, chargeId: "ch_1" });
    const tx = mockTx(0);
    const r = await settleChargePaid("ch_1", 39700);
    expect(r).toMatchObject({ settled: false, found: true });
    expect(tx.financialTransaction.create).not.toHaveBeenCalled();
  });

  it("cobrança desconhecida → settled false, found false (webhook deve 404)", async () => {
    p.payment.findFirst.mockResolvedValue(null);
    const r = await settleChargePaid("ch_x", 100);
    expect(r).toMatchObject({ settled: false, found: false });
  });
});
