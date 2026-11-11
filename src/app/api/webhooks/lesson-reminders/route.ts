import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMetaTemplate } from "@/lib/whatsapp/meta";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_API_VERSION, META_REMINDER_TEMPLATE } = process.env;
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID || !META_API_VERSION || !META_REMINDER_TEMPLATE)
    return NextResponse.json({ status: "WhatsApp aguardando configuração" });
  const bookings = await prisma.lessonBooking.findMany({
    where: {
      reminderSentAt: null,
      status: "SCHEDULED",
      confirmation: "PENDING",
      student: { studentProfile: { whatsappOptIn: true }, isActive: true, phone: { not: null } },
      lesson: {
        cohortId: { not: null },
        status: "SCHEDULED",
        scheduledAt: { gt: new Date(), lte: new Date(Date.now() + 86400000) },
      },
    },
    include: { student: { select: { name: true, phone: true } }, lesson: true },
    take: 50,
  });
  let sent = 0;
  for (const booking of bookings) {
    const claimed = await prisma.lessonBooking.updateMany({
      where: { id: booking.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    });
    if (!claimed.count) continue;
    try {
      await sendMetaTemplate(
        { accessToken: META_ACCESS_TOKEN, phoneNumberId: META_PHONE_NUMBER_ID, apiVersion: META_API_VERSION },
        booking.student.phone!.replace(/\D/g, ""),
        META_REMINDER_TEMPLATE,
        [
          booking.student.name,
          booking.lesson.title,
          booking.lesson.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          booking.responseToken,
        ]
      );
      sent++;
    } catch {
      // Ambiguous network delivery must be reconciled before attempting another send.
      await prisma.auditLog.create({
        data: { action: "WHATSAPP_DELIVERY_UNCERTAIN", entity: "LessonBooking", entityId: booking.id },
      });
    }
  }
  return NextResponse.json({ sent, considered: bookings.length });
}
