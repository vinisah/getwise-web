"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Eyebrow } from "@/components/gw/primitives";
import { useMobileNav } from "@/components/dashboard/mobile-nav";
import { Search, Bell, LogOut, Menu } from "lucide-react";

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
  "/admin/employees": { title: "Funcionários", sub: "Folha de pagamento" },
  "/admin/employees/new": { title: "Novo Funcionário" },
  "/admin/courses": { title: "Cursos", sub: "Estrutura de cursos por nível" },
  "/admin/courses/new": { title: "Novo Curso" },
  "/student": { title: "Olá! 👋", sub: "Portal do aluno" },
  "/student/courses": { title: "Cursos", sub: "Sua trilha de aprendizado" },
  "/student/exercises": { title: "Exercícios", sub: "Pratique vocabulário e gramática" },
  "/student/tutor": { title: "Tutor de Inglês", sub: "Powered by IA · Pratique a qualquer hora" },
  "/student/certificates": { title: "Certificados", sub: "Suas conquistas" },
  "/teacher": { title: "Dashboard", sub: "Portal do professor" },
};

export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { setOpen } = useMobileNav();
  const role = (session?.user as { role?: string } | undefined)?.role || "STUDENT";

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
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.025em", marginTop: 3 }}>{meta.title}</h1>
          {meta.sub && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{meta.sub}</p>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="gw-search">
          <Search size={17} color="var(--muted)" />
          <input placeholder="Buscar..." />
          <kbd>⌘K</kbd>
        </div>
        <button className="gw-icon-btn" title="Notificações">
          <Bell size={19} />
          <span className="gw-badge-dot" />
        </button>
        <button className="gw-icon-btn" title="Sair" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
