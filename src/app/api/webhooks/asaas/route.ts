import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { getBoletoProvider } from "@/lib/billing/provider";
import { settleChargePaid } from "@/lib/billing/generate";

export const runtime = "nodejs";

/**
 * Webhook do Asaas — confirma pagamento de boleto e dá baixa na mensalidade.
 * Isento de auth no proxy.ts (chamada server-to-server, sem cookie); autoprotege pelo
 * header `asaas-access-token` que deve bater com ASAAS_WEBHOOK_TOKEN (configurado no painel Asaas).
 *
 * Não confia no `value` do corpo: re-consulta o Asaas (getCharge) p/ confirmar pagamento e valor
 * real antes de gravar receita (anti-forja com token vazado / anti-payload adulterado).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const got = req.headers.get("asaas-access-token");
  if (!expected || got !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { event?: string; payment?: { id?: string } } | null;
  const event = body?.event;
  const chargeId = body?.payment?.id;

  const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
  if (!event || !PAID_EVENTS.has(event) || !chargeId) {
    return NextResponse.json({ ignored: event ?? "sem evento" });
  }

  // Fonte de verdade = o próprio Asaas, não o corpo do webhook.
  const confirmed = await getBoletoProvider().getCharge(chargeId);
  if (!confirmed.paid) {
    return NextResponse.json({ ignored: "cobrança não confirmada como paga no provedor" });
  }

  const result = await settleChargePaid(chargeId, confirmed.paidValueCents);

  // Cobrança ainda não conhecida localmente (ex.: corrida com a gravação do chargeId) → 404
  // para o Asaas reenviar; "encontrada mas já paga" responde 200 (não precisa retentar).
  if (!result.found) {
    return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ received: true, settled: result.settled, paymentId: result.paymentId ?? null });
});
