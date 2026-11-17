/**
 * Lista CANÔNICA das seções do painel admin (RBAC). Fonte única usada pela sidebar (filtra),
 * pela tela de perfis (checkboxes) e pelo proxy (gate de rota). `route` é o prefixo de match.
 * /admin/profiles é gerido junto de "users" (gerenciar perfis = conceder acesso).
 */
export interface AdminSection {
  key: string;
  label: string;
  group: "Gestão" | "Operação" | "Controle";
  route: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "dashboard", label: "Dashboard", group: "Gestão", route: "/admin" },
  { key: "students", label: "Alunos", group: "Gestão", route: "/admin/students" },
  { key: "pre-enrollments", label: "Pré-matrículas", group: "Gestão", route: "/admin/pre-enrollments" },
  { key: "school-units", label: "Unidades", group: "Gestão", route: "/admin/school-units" },
  { key: "courses", label: "Cursos", group: "Gestão", route: "/admin/courses" },
  { key: "enrollments", label: "Matrículas", group: "Gestão", route: "/admin/enrollments" },
  { key: "plans", label: "Planos", group: "Gestão", route: "/admin/plans" },
  { key: "lessons", label: "Aulas", group: "Gestão", route: "/admin/lessons" },
  { key: "financial", label: "Financeiro", group: "Operação", route: "/admin/financial" },
  { key: "receivables", label: "Cobranças", group: "Operação", route: "/admin/receivables" },
  { key: "payroll", label: "Folha", group: "Operação", route: "/admin/payroll" },
  { key: "employees", label: "Funcionários", group: "Operação", route: "/admin/employees" },
  { key: "dre", label: "DRE", group: "Controle", route: "/admin/dre" },
  { key: "audit", label: "Auditoria", group: "Controle", route: "/admin/audit" },
  { key: "users", label: "Usuários e perfis", group: "Controle", route: "/admin/users" },
];

export const ADMIN_SECTION_KEYS: string[] = ADMIN_SECTIONS.map((s) => s.key);
