import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mocks isolam o handler do provedor e da camada de dados.
const { mockGetCharge, mockSettle } = vi.hoisted(() => ({
  mockGetCharge: vi.fn(),
  mockSettle: vi.fn(),
}));
vi.mock("@/lib/billing/provider", () => ({ getBoletoProvider: () => ({ getCharge: mockGetCharge }) }));
vi.mock("@/lib/billing/generate", () => ({ settleChargePaid: mockSettle }));

import { POST } from "@/app/api/webhooks/asaas/route";

function req(body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) headers["asaas-access-token"] = token;
  return new NextRequest("http://localhost/api/webhooks/asaas", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = "segredo";
  mockGetCharge.mockReset();
  mockSettle.mockReset();
});

describe("POST /api/webhooks/asaas", () => {
  it("token errado → 401, não consulta nem dá baixa", async () => {
    const res = await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "c1" } }, "errado"));
    expect(res.status).toBe(401);
    expect(mockGetCharge).not.toHaveBeenCalled();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("sem token configurado → 401", async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    const res = await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "c1" } }, "segredo"));
    expect(res.status).toBe(401);
  });

  it("evento não-pago → ignorado (200), sem baixa", async () => {
    const res = await POST(req({ event: "PAYMENT_CREATED", payment: { id: "c1" } }, "segredo"));
    expect(res.status).toBe(200);
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it("re-consulta o provedor; se NÃO confirmado, não dá baixa (anti-forja)", async () => {
    mockGetCharge.mockResolvedValue({ paid: false, paidValueCents: 0 });
    const res = await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "c1", value: 9999 } }, "segredo"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ignored).toBeTruthy();
    expect(mockSettle).not.toHaveBeenCalled(); // não confiou no value do corpo
  });

  it("confirmado pelo provedor → baixa com o valor do PROVEDOR (não do corpo)", async () => {
    mockGetCharge.mockResolvedValue({ paid: true, paidValueCents: 39700 });
    mockSettle.mockResolvedValue({ settled: true, found: true, paymentId: "pay_1" });
    const res = await POST(req({ event: "PAYMENT_RECEIVED", payment: { id: "c1", value: 1 } }, "segredo"));
    expect(res.status).toBe(200);
    expect(mockSettle).toHaveBeenCalledWith("c1", 39700); // valor do provedor, ignora value=1 do corpo
  });

  it("cobrança não encontrada localmente → 404 (Asaas retenta)", async () => {
    mockGetCharge.mockResolvedValue({ paid: true, paidValueCents: 39700 });
    mockSettle.mockResolvedValue({ settled: false, found: false });
    const res = await POST(req({ event: "PAYMENT_CONFIRMED", payment: { id: "c1" } }, "segredo"));
    expect(res.status).toBe(404);
  });
});
