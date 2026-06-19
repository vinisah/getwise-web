"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Eyebrow } from "@/components/gw/primitives";
import { useMobileNav } from "@/components/dashboard/mobile-nav";
import { TweaksPanel } from "@/components/gw/tweaks-panel";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { LogOut, Menu } from "lucide-react";

const TITLES: Record<string, { title: string; sub?: string }> = {
  "/admin": { title: "Dashboard", sub: "Visão geral do mês" },
  "/admin/students": { title: "Alunos", sub: "Gestão de alunos cadastrados" },
  "/admin/students/new": { title: "Novo Aluno", sub: "Cadastrar aluno no sistema" },
  "/admin/enrollments": { title: "Matrículas", sub: "Vínculos de alunos a planos" },
  "/admin/enrollments/new": { title: "Nova Matrícula" },
  "/admin/lessons": { title: "Aulas", sub: "Agenda de aulas" },
  "/admin/lessons/new": { title: "Nova Aula" },
  "/admin/financial": { title: "Financeiro", sub: "Receitas e despesas" },
  "/admin/financial/new": { title: "Nova Transação" },
  "/admin/receivables": { title: "Cobranças", sub: "Contas a receber e inadimplência" },
  "/admin/payroll": { title: "Folha", sub: "Folha de pagamento (BR)" },
  "/admin/employees": { title: "Funcionários", sub: "Folha de pagamento" },
  "/admin/employees/new": { title: "Novo Funcionário" },
  "/admin/plans": { title: "Planos", sub: "Planos e mensalidades" },
  "/admin/courses": { title: "Cursos", sub: "Estrutura de cursos por nível" },
  "/admin/courses/new": { title: "Novo Curso" },
  "/admin/dre": { title: "DRE", sub: "Demonstrativo de Resultado do Exercício" },
  "/admin/audit": { title: "Auditoria", sub: "Registro de atividades" },
  "/admin/users": { title: "Usuários", sub: "Acesso e permissões" },
  "/student": { title: "Olá! 👋", sub: "Portal do aluno" },
  "/student/courses": { title: "Cursos", sub: "Sua trilha de aprendizado" },
  "/student/lessons": { title: "Aulas", sub: "Suas aulas agendadas" },
  "/student/exercises": { title: "Exercícios", sub: "Pratique vocabulário e gramática" },
  "/student/tutor": { title: "Tutor de Inglês", sub: "Powered by IA · Pratique a qualquer hora" },
  "/student/certificates": { title: "Certificados", sub: "Suas conquistas" },
  "/teacher": { title: "Dashboard", sub: "Portal do professor" },
  "/teacher/lessons": { title: "Minhas Aulas", sub: "Agenda e presença" },
};

export function Topbar({ previewRole }: { previewRole?: string } = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { setOpen } = useMobileNav();
  const realRole = (session?.user as { role?: string } | undefined)?.role;
  // Papel da visão atual (previewRole quando admin "vendo como" aluno/professor).
  const role = previewRole || realRole || "STUDENT";

  const meta = TITLES[pathname] || { title: "Get Wise" };
  const eyebrow =
    role === "ADMIN" ? "Painel administrativo" : role === "TEACHER" ? "Portal do professor" : "Portal do aluno";

  return (
    <header className="gw-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="gw-burger" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.025em", marginTop: 3 }}>
            {meta.title}
          </h1>
          {meta.sub && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{meta.sub}</p>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CommandPalette />
        <TweaksPanel />
        <NotificationBell />
        {realRole === "ADMIN" && <RoleSwitcher current={role} />}
        <button
          className="gw-icon-btn"
          title="Sair"
          aria-label="Sair"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
