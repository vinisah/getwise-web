import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature } from "@/lib/whatsapp/meta";
import { respond } from "@/lib/scheduling/service";
import { ApiError } from "@/lib/api-error";

export const runtime = "nodejs";

async function reply(to: string, body: string) {
  const version = process.env.META_API_VERSION;
  const phone = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN;
  if (!version || !phone || !token) throw new Error("WhatsApp não configurado");
  const response = await fetch("https://graph.facebook.com/" + version + "/" + phone + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Falha ao responder pelo WhatsApp");
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (!token || params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== token)
    return new Response("Forbidden", { status: 403 });
  return new Response(params.get("hub.challenge") ?? "");
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET ?? ""))
    return new Response("Forbidden", { status: 403 });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  try {
    for (const entry of payload.entry ?? [])
      for (const change of entry.changes ?? []) {
        if (change.value?.metadata?.phone_number_id !== process.env.META_PHONE_NUMBER_ID) continue;
        for (const message of change.value?.messages ?? []) {
          if (typeof message.id !== "string" || (await prisma.whatsAppEvent.findUnique({ where: { id: message.id } })))
            continue;
          const text = message.text?.body ?? message.button?.payload ?? "";
          const [command, token, ...words] = text.trim().split(/\s+/);
          const booking = token
            ? await prisma.lessonBooking.findUnique({
                where: { responseToken: token },
                include: { student: { select: { phone: true, isActive: true } }, lesson: true },
              })
            : null;
          const phone = booking?.student.phone?.replace(/\D/g, "");
          if (!booking || !booking.student.isActive || phone !== message.from) {
            await reply(
              message.from,
              "Use o código do lembrete da sua aula. Envie CONFIRMAR código, FALTAR código justificativa, HORARIOS código AAAA-MM-DD ou RESERVAR código identificação-da-aula."
            );
          } else {
            try {
              switch (command.toUpperCase()) {
                case "CONFIRMAR":
                  await respond(booking.studentId, { action: "confirm", bookingId: booking.id });
                  await reply(message.from, "Participação confirmada. Até a aula!");
                  break;
                case "FALTAR":
                  if (words.join(" ").length < 2) throw new ApiError(400, "Inclua sua justificativa após o código.");
                  await respond(booking.studentId, {
                    action: "decline",
                    bookingId: booking.id,
                    reason: words.join(" "),
                  });
                  await reply(
                    message.from,
                    "Ausência registrada. Qual o melhor dia? Envie HORARIOS " + token + " AAAA-MM-DD."
                  );
                  break;
                case "HORARIOS": {
                  const day = words[0];
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") || Number.isNaN(Date.parse(day)))
                    throw new ApiError(400, "Informe o dia como AAAA-MM-DD.");
                  const start = new Date(day + "T00:00:00-03:00");
                  const lessons = await prisma.lesson.findMany({
                    where: {
                      cohortId: { not: null },
                      level: booking.lesson.level,
                      status: "SCHEDULED",
                      scheduledAt: {
                        gte: new Date(Math.max(start.getTime(), Date.now())),
                        lt: new Date(start.getTime() + 86400000),
                      },
                    },
                    include: { _count: { select: { bookings: { where: { status: { not: "CANCELLED" } } } } } },
                    orderBy: { scheduledAt: "asc" },
                  });
                  const available = lessons
                    .filter((l) => l.id !== booking.lessonId && l._count.bookings < l.maxStudents)
                    .slice(0, 10);
                  await reply(
                    message.from,
                    available.length
                      ? available
                          .map(
                            (l) =>
                              l.scheduledAt.toLocaleTimeString("pt-BR", {
                                timeZone: "America/Sao_Paulo",
                                hour: "2-digit",
                                minute: "2-digit",
                              }) +
                              " · " +
                              l.title +
                              "\nRESERVAR " +
                              token +
                              " " +
                              l.id
                          )
                          .join("\n\n")
                      : "Sem vagas neste dia. Seus próximos encontros da agenda pedagógica continuam confirmáveis normalmente."
                  );
                  break;
                }
                case "RESERVAR":
                  await respond(booking.studentId, {
                    action: "reschedule",
                    bookingId: booking.id,
                    lessonId: words[0] ?? "",
                  });
                  await reply(message.from, "Remarcação concluída. A agenda do professor foi atualizada.");
                  break;
                default:
                  await reply(
                    message.from,
                    "Envie CONFIRMAR " + token + " ou FALTAR " + token + " seguido da justificativa."
                  );
              }
            } catch (error) {
              if (!(error instanceof ApiError)) throw error;
              await reply(message.from, error.message);
            }
          }
          await prisma.whatsAppEvent.upsert({ where: { id: message.id }, create: { id: message.id }, update: {} });
        }
      }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Falha temporária" }, { status: 503 });
  }
}
