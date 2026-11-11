import { NextRequest, NextResponse, after } from "next/server";
import { ApiError, withErrorHandler, zodMessage } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateEnrollmentSchema } from "@/lib/schemas";
import { generateChargeForPayment } from "@/lib/billing/generate";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const StatusFilter = z.enum(["ACTIVE", "SUSPENDED", "CANCELLED", "COMPLETED"]);

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("enrollments");

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  // Valida o status contra o enum — evita repassar lixo direto ao Prisma.
  let status: z.infer<typeof StatusFilter> | undefined;
  if (rawStatus) {
    const parsed = StatusFilter.safeParse(rawStatus);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }
    status = parsed.data;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: status ? { status } : {},
    include: {
      student: true,
      plan: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(enrollments);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin("enrollments");

  const parsed = CreateEnrollmentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }

  const { studentId, planId, startDate, notes } = parsed.data;
  const discount = parsed.data.discount ?? 0; // centavos

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new ApiError(404, "Plano não encontrado");

  // Desconto não pode exceder o valor do plano (garante mensalidade ≥ 0).
  if (discount > plan.price) {
    throw new ApiError(400, "Desconto maior que o valor do plano");
  }

  const start = new Date(startDate); // já validado como data parseável no schema
  // Mês/ano da 1ª cobrança: preferir os componentes ISO (sem deslocamento de TZ),
  // com fallback seguro p/ outros formatos válidos (evita NaN).
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(startDate);
  const startYear = iso ? Number(iso[1]) : start.getUTCFullYear();
  const startMonth = iso ? Number(iso[2]) : start.getUTCMonth() + 1;
  const monthlyAmount = plan.price - discount; // centavos

  // Atômico: cria a matrícula + a 1ª mensalidade PENDENTE (registro interno; boleto gerado à parte).
  const { enrollment, paymentId } = await prisma.$transaction(async (tx) => {
    const en = await tx.enrollment.create({
      data: {
        studentId,
        planId,
        startDate: start,
        discount,
        notes: notes || null,
        status: "ACTIVE",
      },
      include: { student: true, plan: true },
    });

    const pay = await tx.payment.create({
      data: {
        enrollmentId: en.id,
        studentId,
        amount: monthlyAmount,
        status: "PENDING",
        description: `Mensalidade ${plan.name} — ${String(startMonth).padStart(2, "0")}/${startYear}`,
        dueDate: start,
        month: startMonth,
        year: startYear,
      },
    });

    return { enrollment: en, paymentId: pay.id };
  });

  // Gera o boleto da 1ª mensalidade em background — não bloqueia nem derruba a matrícula
  // se o provedor falhar (com o Stub default vira no-op logado). O try externo protege
  // contextos sem request scope (ex.: testes que invocam o handler direto), onde after() lança.
  try {
    after(async () => {
      try {
        await generateChargeForPayment(paymentId);
      } catch (e) {
        console.error("[billing] falha ao gerar boleto da matrícula", paymentId, e instanceof Error ? e.name : "UnknownError");
      }
    });
  } catch {
    /* fora de escopo de request — geração em background indisponível, segue sem bloquear */
  }

  await audit({ userId: session.user.id, action: "CREATE_ENROLLMENT", entity: "Enrollment", entityId: enrollment.id });

  return NextResponse.json(enrollment, { status: 201 });
});
