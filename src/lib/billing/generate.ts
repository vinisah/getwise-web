/**
 * Geração automática de cobranças (boleto) e baixa via webhook.
 * Usa o provedor plugável (lib/billing/provider). Com o Stub default nada é emitido
 * de verdade — ativa Asaas com BILLING_PROVIDER=asaas + ASAAS_API_KEY.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBoletoProvider } from "@/lib/billing/provider";
import { categoryIdByName, SYSTEM_CATEGORY } from "@/lib/financial-categories";
import { createNotification } from "@/lib/services/notifications";

export interface GenerateResult {
  paymentId: string;
  status: "created" | "skipped" | "error";
  chargeId?: string;
  reason?: string;
}

/**
 * Gera a cobrança de UM pagamento. Idempotente: pula se não estiver PENDENTE ou se já
 * tiver chargeId. A gravação usa updateMany condicional (anti-corrida / anti-duplicação).
 */
export async function generateChargeForPayment(paymentId: string): Promise<GenerateResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: { select: { name: true, email: true, phone: true, studentProfile: { select: { cpf: true } } } },
    },
  });
  if (!payment) return { paymentId, status: "error", reason: "Pagamento não encontrado" };
  if (payment.status !== "PENDING") return { paymentId, status: "skipped", reason: `status ${payment.status}` };
  if (payment.chargeId)
    return { paymentId, status: "skipped", reason: "cobrança já existe", chargeId: payment.chargeId };

  // Registros acadêmicos de crianças não possuem caixa postal própria.
  // Mantém o pagador definido pelo fluxo financeiro e usa o contato da conta responsável.
  let contactEmail = payment.student.email;
  if (contactEmail.endsWith("@students.getwise.invalid")) {
    const application = await prisma.preEnrollment.findFirst({
      where: { studentId: payment.studentId, status: "ENROLLED" },
      orderBy: { updatedAt: "desc" },
      select: { applicant: { select: { email: true } } },
    });
    if (!application) return { paymentId, status: "error", reason: "Contato do responsável não encontrado" };
    contactEmail = application.applicant.email;
  }

  const provider = getBoletoProvider();
  const charge = await provider.createCharge({
    paymentId: payment.id,
    amountCents: payment.amount,
    dueDate: payment.dueDate,
    description: payment.description ?? `Mensalidade ${payment.month}/${payment.year}`,
    customer: {
      name: payment.student.name,
      email: contactEmail,
      phone: payment.student.phone,
      taxId: payment.student.studentProfile?.cpf ?? null,
    },
  });

  // Só grava se ainda não houver chargeId (duas gerações simultâneas → só a 1ª persiste).
  const res = await prisma.payment.updateMany({
    where: { id: payment.id, chargeId: null },
    data: { chargeId: charge.chargeId, boletoUrl: charge.boletoUrl, boletoLine: charge.boletoLine, method: "BOLETO" },
  });
  if (res.count === 0) return { paymentId, status: "skipped", reason: "cobrança gerada em paralelo" };

  // Notifica o aluno (1x — só na 1ª geração da cobrança; best-effort).
  const overdue = payment.dueDate.getTime() < Date.now();
  await createNotification({
    userId: payment.studentId,
    type: overdue ? "PAYMENT_OVERDUE" : "PAYMENT_DUE",
    title: overdue ? "Mensalidade vencida" : "Mensalidade a vencer",
    body: overdue
      ? `Sua mensalidade ${payment.month}/${payment.year} está vencida.`
      : `Sua mensalidade ${payment.month}/${payment.year} vence em ${payment.dueDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
  });

  return { paymentId, status: "created", chargeId: charge.chargeId };
}

/** Gera cobranças para todas as mensalidades PENDENTES sem boleto que vencem em até `withinDays` dias. */
export async function generateDueCharges(
  withinDays = 7
): Promise<{ created: number; skipped: number; errors: number; results: GenerateResult[] }> {
  const limit = new Date(Date.now() + withinDays * 86_400_000);
  const pending = await prisma.payment.findMany({
    where: { status: "PENDING", chargeId: null, dueDate: { lte: limit } },
    select: { id: true },
    orderBy: { dueDate: "asc" },
  });

  const results: GenerateResult[] = [];
  for (const p of pending) {
    try {
      results.push(await generateChargeForPayment(p.id));
    } catch (e) {
      results.push({ paymentId: p.id, status: "error", reason: e instanceof Error ? e.message : "erro desconhecido" });
    }
  }
  return {
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  };
}

/**
 * Baixa de cobrança paga, com o valor JÁ CONFIRMADO no provedor (o webhook re-consulta o Asaas
 * em vez de confiar no corpo do POST). Idempotente: marca PAID só se ainda não estava, e cria a
 * receita única (reference @unique = payment:<id>).
 *
 * Retorna `found` para o webhook distinguir "cobrança desconhecida" (deve 404 → Asaas retenta)
 * de "já estava paga / no-op" (200).
 */
export async function settleChargePaid(
  chargeId: string,
  paidValueCents: number
): Promise<{ settled: boolean; found: boolean; paymentId?: string }> {
  const payment = await prisma.payment.findFirst({
    where: { chargeId },
    include: { student: { select: { name: true } } },
  });
  if (!payment) return { settled: false, found: false };

  // Anti-subpagamento: só dá baixa total se o valor pago cobre a mensalidade. Pagamento parcial
  // NÃO marca PAID (ficaria fechado por menos do que foi cobrado e sem como re-cobrar o saldo).
  if (paidValueCents < payment.amount) {
    console.warn(
      `[billing] pagamento parcial ignorado: payment=${payment.id} pago=${paidValueCents} < devido=${payment.amount}`
    );
    return { settled: false, found: true, paymentId: payment.id };
  }

  const reference = `payment:${payment.id}`;
  const ref = `${String(payment.month).padStart(2, "0")}/${payment.year}`;
  // Categoria p/ o DRE (receita bruta). Sem isso, a receita do boleto cai em "não classificado".
  const mensalidadeCatId = await categoryIdByName(SYSTEM_CATEGORY.MENSALIDADE);

  return prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: new Date(), amountPaid: paidValueCents, method: "BOLETO" },
    });
    if (res.count === 0) return { settled: false, found: true, paymentId: payment.id }; // já paga → no-op

    try {
      await tx.financialTransaction.create({
        data: {
          type: "INCOME",
          amount: paidValueCents,
          description: `Mensalidade ${payment.student.name} — ${ref} (boleto)`,
          date: new Date(),
          isPaid: true,
          paidAt: new Date(),
          paymentMethod: "BOLETO",
          categoryId: mensalidadeCatId,
          reference,
          createdBy: null,
        },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
    return { settled: true, found: true, paymentId: payment.id };
  });
}
