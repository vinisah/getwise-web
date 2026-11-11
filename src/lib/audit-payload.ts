// Metadados de operação. Texto livre, nomes, contatos, conteúdo de IA e credenciais
// não pertencem à trilha de auditoria; o registro de origem fica no banco de negócio.
const FIELDS = new Set([
  "success", "passwordless", "registered", "emailSent", "emailVerified", "passwordReset",
  "role", "isActive", "passwordChanged", "profileId", "percent", "plansUpdated",
  "withinDays", "created", "skipped", "errors", "progressPercent", "courseCompleted",
  "courseId", "type", "gross", "net", "status", "amountPaid", "count", "archived",
]);

export function safeAuditPayload(payload: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!FIELDS.has(key)) continue;
    if (value === null || typeof value === "boolean") safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "string" && key !== "errors" && value.length <= 100) safe[key] = value;
  }
  return safe;
}
