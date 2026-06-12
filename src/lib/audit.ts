import { prisma } from "./prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE_STUDENT"
  | "UPDATE_STUDENT"
  | "DELETE_STUDENT"
  | "CREATE_ENROLLMENT"
  | "UPDATE_ENROLLMENT"
  | "DELETE_ENROLLMENT"
  | "CREATE_TRANSACTION"
  | "UPDATE_TRANSACTION"
  | "DELETE_TRANSACTION"
  | "CREATE_LESSON"
  | "UPDATE_LESSON"
  | "DELETE_LESSON"
  | "CREATE_EMPLOYEE"
  | "UPDATE_EMPLOYEE"
  | "DELETE_EMPLOYEE"
  | "CREATE_SALARY_PAYMENT"
  | "GENERATE_RECURRING"
  | "UPDATE_USER"
  | "ADJUST_PLANS"
  | "CREATE_EXERCISE"
  | "ATTEMPT_EXERCISE"
  | "AI_CHAT"
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "REGISTER"
  | "VERIFY_EMAIL"
  | "PASSWORD_RESET"
  | "CREATE_COURSE"
  | "UPDATE_COURSE"
  | "DELETE_COURSE"
  | "CREATE_MODULE"
  | "UPDATE_MODULE"
  | "DELETE_MODULE"
  | "CREATE_UNIT"
  | "UPDATE_UNIT"
  | "DELETE_UNIT"
  | "ADD_PREREQUISITE"
  | "REMOVE_PREREQUISITE"
  | "COMPLETE_UNIT"
  | "ISSUE_CERTIFICATE";

interface AuditParams {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  /** Dados relevantes — nunca incluir senhas ou secrets */
  payload?: Record<string, unknown>;
  ip?: string;
}

/**
 * Registra uma ação crítica no audit log.
 * Fail-safe: se a escrita falhar, apenas loga — nunca quebra a operação principal.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        payload: params.payload
          ? (params.payload as import("@prisma/client").Prisma.InputJsonValue)
          : undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    // Fail loud no log mas não propaga — audit jamais deve derrubar a rota principal
    console.error("[AUDIT FAIL]", params.action, err);
  }
}

/**
 * Extrai IP do request de forma segura (funciona atrás de proxy/CDN).
 */
export function getClientIp(req: Request): string {
  const forwardedFor = (req.headers as Headers).get?.("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
