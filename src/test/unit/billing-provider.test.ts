import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getBoletoProvider, __resetBoletoProvider } from "@/lib/billing/provider";

const ENV_KEYS = ["BILLING_PROVIDER", "ASAAS_API_KEY", "ASAAS_ENV"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  __resetBoletoProvider();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetBoletoProvider();
  vi.restoreAllMocks();
});

describe("getBoletoProvider (factory)", () => {
  it("default = stub (sem env)", () => {
    expect(getBoletoProvider().name).toBe("stub");
  });
  it("BILLING_PROVIDER=asaas sem key → cai no stub (fail-safe)", () => {
    process.env.BILLING_PROVIDER = "asaas";
    expect(getBoletoProvider().name).toBe("stub");
  });
  it("BILLING_PROVIDER=asaas + key → asaas", () => {
    process.env.BILLING_PROVIDER = "asaas";
    process.env.ASAAS_API_KEY = "fake_key";
    expect(getBoletoProvider().name).toBe("asaas");
  });
});

describe("StubBoletoProvider", () => {
  it("createCharge devolve chargeId stub_<id> e sem boleto real", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const charge = await getBoletoProvider().createCharge({
      paymentId: "pay_1",
      amountCents: 39700,
      dueDate: new Date("2026-07-10"),
      description: "Mensalidade",
      customer: { name: "Aluno", email: "a@x.com", phone: "119", taxId: "12345678909" },
    });
    expect(charge.chargeId).toBe("stub_pay_1");
    expect(charge.boletoUrl).toBeNull();
  });
  it("getCharge nunca confirma pago (stub)", async () => {
    expect(await getBoletoProvider().getCharge("x")).toEqual({ paid: false, paidValueCents: 0 });
  });
});

describe("AsaasBoletoProvider (fetch mockado)", () => {
  function setupAsaas() {
    process.env.BILLING_PROVIDER = "asaas";
    process.env.ASAAS_API_KEY = "fake_key";
    process.env.ASAAS_ENV = "sandbox";
    __resetBoletoProvider();
  }
  function res(body: unknown, ok = true, status = 200) {
    return { ok, status, text: async () => JSON.stringify(body) } as unknown as Response;
  }

  it("data UTC-meia-noite vira o MESMO dia no boleto (sem off-by-one) + multa/juros no payload", async () => {
    setupAsaas();
    let paymentsBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/payments?externalReference")) return res({ data: [] });
      if (u.includes("/customers") && method === "GET") return res({ data: [] });
      if (u.includes("/customers") && method === "POST") return res({ id: "cus_1" });
      if (u.endsWith("/payments") && method === "POST") {
        paymentsBody = JSON.parse(String(init?.body));
        return res({ id: "pay_asaas_1", bankSlipUrl: "https://asaas/boleto.pdf" });
      }
      if (u.includes("/identificationField")) return res({ identificationField: "00190..." });
      throw new Error(`URL inesperada: ${method} ${u}`);
    });

    const charge = await getBoletoProvider().createCharge({
      paymentId: "pay_1",
      amountCents: 39700,
      dueDate: new Date("2026-07-10T00:00:00.000Z"), // valor real que o app grava
      description: "Mensalidade",
      customer: { name: "Aluno", email: "a@x.com", phone: "119", taxId: "12345678909" },
    });

    expect(charge.chargeId).toBe("pay_asaas_1");
    expect(charge.boletoUrl).toBe("https://asaas/boleto.pdf");
    expect(charge.boletoLine).toBe("00190...");
    expect(paymentsBody!.dueDate).toBe("2026-07-10"); // NÃO 2026-07-09
    expect(paymentsBody!.value).toBe(397);
    expect(paymentsBody!.fine).toEqual({ value: 2, type: "PERCENTAGE" });
    expect(paymentsBody!.interest).toEqual({ value: 1 });
    expect(paymentsBody!.externalReference).toBe("pay_1");
  });

  it("idempotência: cobrança já existe p/ o externalReference → reaproveita, NÃO cria nova", async () => {
    setupAsaas();
    let postedPayment = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      const method = (init?.method ?? "GET").toUpperCase();
      if (u.includes("/payments?externalReference"))
        return res({ data: [{ id: "ja_existe", invoiceUrl: "https://asaas/i" }] });
      if (u.includes("/identificationField")) return res({});
      if (u.endsWith("/payments") && method === "POST") {
        postedPayment = true;
        return res({ id: "novo" });
      }
      throw new Error(`URL inesperada: ${method} ${u}`);
    });
    const charge = await getBoletoProvider().createCharge({
      paymentId: "pay_1",
      amountCents: 100,
      dueDate: new Date("2026-07-10"),
      description: "x",
      customer: { name: "A", email: null, phone: null, taxId: "12345678909" },
    });
    expect(postedPayment).toBe(false);
    expect(charge.chargeId).toBe("ja_existe");
  });

  it("getCharge mapeia status RECEIVED → paid + valor em centavos", async () => {
    setupAsaas();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ id: "p", status: "RECEIVED", value: 397 }));
    expect(await getBoletoProvider().getCharge("p")).toEqual({ paid: true, paidValueCents: 39700 });
  });

  it("getCharge status PENDING → não pago", async () => {
    setupAsaas();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res({ id: "p", status: "PENDING", value: 397 }));
    expect((await getBoletoProvider().getCharge("p")).paid).toBe(false);
  });

  it("aluno sem CPF → erro claro (não cria cobrança)", async () => {
    setupAsaas();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("/payments?externalReference")) return res({ data: [] });
      return res({ data: [] });
    });
    await expect(
      getBoletoProvider().createCharge({
        paymentId: "pay_3",
        amountCents: 100,
        dueDate: new Date(),
        description: "x",
        customer: { name: "A", email: null, phone: null, taxId: null },
      })
    ).rejects.toThrow(/CPF/i);
  });
});
