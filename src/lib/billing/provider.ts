/**
 * Provedor de cobrança (boleto/PIX) — PLUGÁVEL, no mesmo espírito de rate-limit-store.
 *
 * - Default: `StubBoletoProvider` (não emite nada real; devolve placeholder e loga).
 *   Mantém dev/test/local funcionando sem credencial.
 * - Real: `AsaasBoletoProvider` — ativa quando `BILLING_PROVIDER=asaas` + `ASAAS_API_KEY`.
 *   O Asaas gera o boleto e NOTIFICA o aluno por WhatsApp/e-mail nativamente (configurar
 *   as notificações no painel Asaas + o cliente precisa ter telefone/CPF). O app só cria a cobrança.
 *
 * Idempotência: usamos `externalReference = paymentId` no provedor; antes de criar, consultamos
 * se já existe cobrança com esse externalReference (Asaas NÃO deduplica sozinho), evitando boleto
 * duplicado em retry. Localmente também gravamos `chargeId` e pulamos pagamentos que já o têm.
 */

export interface ChargeCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  /** CPF/CNPJ — obrigatório para emitir boleto registrado (Asaas exige). */
  taxId: string | null;
}

export interface CreateChargeInput {
  /** Nosso Payment.id → vira externalReference no provedor (idempotência + webhook). */
  paymentId: string;
  amountCents: number;
  dueDate: Date;
  description: string;
  customer: ChargeCustomer;
}

export interface ChargeResult {
  chargeId: string;
  boletoUrl: string | null;
  boletoLine: string | null;
}

/** Estado da cobrança consultado no provedor (fonte de verdade do webhook). */
export interface ChargeStatus {
  /** true se o provedor confirma que a cobrança foi efetivamente paga. */
  paid: boolean;
  /** Valor pago em centavos, conforme o provedor (não confiar no corpo do webhook). */
  paidValueCents: number;
}

export interface BoletoProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Consulta o estado real da cobrança no provedor (usado pelo webhook p/ não confiar no payload). */
  getCharge(chargeId: string): Promise<ChargeStatus>;
}

/**
 * Data YYYY-MM-DD do vencimento. `dueDate` é gravado como meia-noite UTC do dia escolhido
 * (enrollments faz `new Date("YYYY-MM-DD")`), então a data-calendário são os componentes UTC
 * diretos — NÃO subtrair fuso (subtrair jogaria para o dia anterior).
 */
function toDueDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Stub (default, sem credencial) ───────────────────────────────────────────

class StubBoletoProvider implements BoletoProvider {
  readonly name = "stub";
  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    console.warn(
      `[billing] StubBoletoProvider: cobrança NÃO emitida de verdade (sem provedor configurado). ` +
        `payment=${input.paymentId} valor=${input.amountCents} venc=${toDueDateString(input.dueDate)}`
    );
    return {
      chargeId: `stub_${input.paymentId}`,
      boletoUrl: null,
      boletoLine: null,
    };
  }
  async getCharge(): Promise<ChargeStatus> {
    // Stub não tem cobrança real; o webhook só roda com provedor real configurado.
    return { paid: false, paidValueCents: 0 };
  }
}

// ─── Asaas (REST, via fetch — sem dependência nova) ───────────────────────────

interface AsaasPayment {
  id: string;
  status?: string;
  value?: number | null;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
}

class AsaasBoletoProvider implements BoletoProvider {
  readonly name = "asaas";
  private base: string;
  // Multa/juros alinhados ao billing.ts (LATE_FEE_RATE 2%, MONTHLY_INTEREST_RATE 1%/mês).
  // Deixar o Asaas cobrar isso evita que boleto pago em atraso escape de multa/juros.
  private static FINE_PERCENT = 2;
  private static INTEREST_PERCENT_MONTH = 1;
  // Status do Asaas que significam "pago/compensado".
  private static PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

  constructor(
    private apiKey: string,
    sandbox: boolean
  ) {
    this.base = sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        access_token: this.apiKey,
        "Content-Type": "application/json",
        "User-Agent": "getwise-web",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Asaas ${res.status} em ${path}: ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async ensureCustomer(input: CreateChargeInput): Promise<string> {
    if (!input.customer.taxId) {
      throw new Error(
        `Asaas: aluno sem CPF/CNPJ cadastrado — não é possível emitir boleto (payment=${input.paymentId}).`
      );
    }
    const found = await this.req<{ data: { id: string }[] }>(
      `/customers?cpfCnpj=${encodeURIComponent(input.customer.taxId)}&limit=1`
    );
    if (found.data?.[0]?.id) return found.data[0].id;

    const created = await this.req<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.customer.name,
        email: input.customer.email ?? undefined,
        mobilePhone: input.customer.phone ?? undefined,
        cpfCnpj: input.customer.taxId,
        notificationDisabled: false,
      }),
    });
    return created.id;
  }

  /** Monta o ChargeResult e busca a linha digitável (best-effort). */
  private async toResult(payment: AsaasPayment): Promise<ChargeResult> {
    let boletoLine: string | null = null;
    try {
      const idf = await this.req<{ identificationField?: string | null }>(
        `/payments/${payment.id}/identificationField`
      );
      boletoLine = idf.identificationField ?? null;
    } catch {
      /* segue sem a linha digitável; o aluno usa o link */
    }
    return {
      chargeId: payment.id,
      boletoUrl: payment.bankSlipUrl ?? payment.invoiceUrl ?? null,
      boletoLine,
    };
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    // Idempotência: se já existe cobrança com esse externalReference, reaproveita (evita boleto
    // duplicado em retry — o Asaas NÃO rejeita externalReference repetido).
    const existing = await this.req<{ data: AsaasPayment[] }>(
      `/payments?externalReference=${encodeURIComponent(input.paymentId)}&limit=1`
    );
    if (existing.data?.[0]?.id) return this.toResult(existing.data[0]);

    const customerId = await this.ensureCustomer(input);
    const payment = await this.req<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: input.amountCents / 100, // Asaas espera reais decimais
        dueDate: toDueDateString(input.dueDate),
        description: input.description,
        externalReference: input.paymentId,
        // Multa/juros após o vencimento (mesma política do billing.ts).
        fine: { value: AsaasBoletoProvider.FINE_PERCENT, type: "PERCENTAGE" },
        interest: { value: AsaasBoletoProvider.INTEREST_PERCENT_MONTH },
      }),
    });
    return this.toResult(payment);
  }

  async getCharge(chargeId: string): Promise<ChargeStatus> {
    const p = await this.req<AsaasPayment>(`/payments/${encodeURIComponent(chargeId)}`);
    return {
      paid: AsaasBoletoProvider.PAID_STATUSES.has(p.status ?? ""),
      paidValueCents: Math.round((p.value ?? 0) * 100),
    };
  }
}

// ─── Factory (singleton) ──────────────────────────────────────────────────────

let provider: BoletoProvider | null = null;

export function getBoletoProvider(): BoletoProvider {
  if (provider) return provider;
  const which = (process.env.BILLING_PROVIDER ?? "stub").toLowerCase();
  const key = process.env.ASAAS_API_KEY;
  if (which === "asaas" && key) {
    const sandbox = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase() !== "production";
    provider = new AsaasBoletoProvider(key, sandbox);
  } else {
    provider = new StubBoletoProvider();
  }
  return provider;
}

/** Só para testes: reseta o singleton do provedor. */
export function __resetBoletoProvider(): void {
  provider = null;
}
