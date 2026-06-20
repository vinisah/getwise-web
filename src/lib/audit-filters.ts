/**
 * Grupos de filtro da auditoria — FONTE ÚNICA usada pela tela (/admin/audit) e pelo export
 * (/api/audit/export). Manter aqui evita que a UI e o CSV divirjam ao adicionar ações novas.
 */
export const AUDIT_FILTERS: Record<string, { label: string; actions?: string[] }> = {
  ALL: { label: "Tudo" },
  FINANCE: {
    label: "Financeiro",
    actions: [
      "CREATE_TRANSACTION",
      "UPDATE_TRANSACTION",
      "DELETE_TRANSACTION",
      "CREATE_SALARY_PAYMENT",
      "PAYMENT_CREATED",
      "PAYMENT_UPDATED",
      "GENERATE_RECURRING",
      "ADJUST_PLANS",
      "BILLING_GENERATE_DUE",
    ],
  },
  PEOPLE: {
    label: "Pessoas",
    actions: [
      "CREATE_STUDENT",
      "UPDATE_STUDENT",
      "DELETE_STUDENT",
      "CREATE_EMPLOYEE",
      "UPDATE_EMPLOYEE",
      "DELETE_EMPLOYEE",
      "CREATE_ENROLLMENT",
      "UPDATE_USER",
      "REGISTER",
      "MARK_ATTENDANCE",
      "ADMIN_PREVIEW",
    ],
  },
  AUTH: { label: "Acesso", actions: ["LOGIN", "LOGOUT", "VERIFY_EMAIL", "PASSWORD_RESET"] },
  CONTENT: {
    label: "Conteúdo",
    actions: [
      "CREATE_COURSE",
      "UPDATE_COURSE",
      "DELETE_COURSE",
      "CREATE_MODULE",
      "UPDATE_MODULE",
      "DELETE_MODULE",
      "CREATE_UNIT",
      "UPDATE_UNIT",
      "DELETE_UNIT",
      "CREATE_EXERCISE",
      "ISSUE_CERTIFICATE",
      "COMPLETE_UNIT",
      "CREATE_LESSON",
      "UPDATE_LESSON",
      "DELETE_LESSON",
    ],
  },
};
