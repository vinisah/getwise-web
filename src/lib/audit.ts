import { prisma } from "./prisma";
import { safeAuditPayload } from "./audit-payload";

export type AuditAction =
  | "REVIEW_PLACEMENT"
  | "REVIEW_PRE_ENROLLMENT"
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
  | "MARK_ATTENDANCE"
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
  | "BILLING_GENERATE_DUE"
  | "ADMIN_PREVIEW"
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
  | "ISSUE_CERTIFICATE"
  | "CREATE_PROFILE"
  | "UPDATE_PROFILE"
  | "DELETE_PROFILE"
  | "ASSIGN_PROFILE";

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
        payload: params.payload ? safeAuditPayload(params.payload) : undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    // Fail loud no log mas não propaga — audit jamais deve derrubar a rota principal
    console.error("[AUDIT FAIL]", params.action, err instanceof Error ? err.name : "UnknownError");
  }
}

/**
 * Extrai IP do request (atrás de proxy/CDN).
 * ⚠️ `x-forwarded-for` é spoofável pelo cliente; preferimos `x-real-ip` (setado
 * pela plataforma/Vercel). Para rate-limit robusto, usar o IP confiável do host.
 */
export function getClientIp(req: Request): string {
  const h = req.headers as Headers;
  const realIp = h.get?.("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = h.get?.("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
