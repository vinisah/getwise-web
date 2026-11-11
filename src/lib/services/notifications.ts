import { prisma } from "../prisma";
import type { NotificationType } from "@prisma/client";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Cria notificação (best-effort). Falha NÃO propaga — gatilhos (certificado, cobrança, aula,
 * folha) não devem derrubar a operação principal.
 */
export async function createNotification(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
    });
  } catch (e) {
    console.error("[notification] falha ao criar", input.type, e instanceof Error ? e.name : "UnknownError");
  }
}
