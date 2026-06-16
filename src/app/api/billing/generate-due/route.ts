import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { generateDueCharges } from "@/lib/billing/generate";

export const runtime = "nodejs";

/**
 * Gera boletos das mensalidades PENDENTES que vencem em breve (cobrança automática).
 * Isento de auth no proxy.ts → autoproteção própria:
 *   - Vercel Cron: header `Authorization: Bearer ${CRON_SECRET}` (Vercel injeta quando CRON_SECRET está setado).
 *   - Admin (disparo manual pela UI): sessão ADMIN via cookie.
 * GET = chamada do cron; POST = disparo manual do admin. Ambos caem no mesmo handler.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let actor = "cron";
  if (!isCron) {
    // Não é o cron → exige admin (lança 403 se não for).
    const session = await requireAdmin();
    actor = session.user.id;
  }

  const { searchParams } = new URL(req.url);
  const withinDays = Math.min(Math.max(Number(searchParams.get("withinDays")) || 7, 1), 60);

  const summary = await generateDueCharges(withinDays);

  if (actor !== "cron") {
    await audit({
      userId: actor,
      action: "BILLING_GENERATE_DUE",
      entity: "Payment",
      payload: { withinDays, created: summary.created, skipped: summary.skipped, errors: summary.errors },
    });
  }

  return NextResponse.json({ ok: true, withinDays, ...summary });
}

export const GET = withErrorHandler(async (req: NextRequest) => handle(req));
export const POST = withErrorHandler(async (req: NextRequest) => handle(req));
