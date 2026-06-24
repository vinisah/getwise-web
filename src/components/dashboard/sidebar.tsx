"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useMobileNav } from "@/components/dashboard/mobile-nav";
import { cx, getInitials } from "@/lib/utils";
import { adminCanAccess } from "@/lib/access";
import { Logo } from "@/components/gw/logo";
import { Avatar } from "@/components/gw/primitives";
import {
  LayoutGrid,
  Users,
  GraduationCap,
  Calendar,
  Wallet,
  UserCheck,
  Banknote,
  Receipt,
  Tag,
  FileBarChart,
  ScrollText,
  ShieldCheck,
  PenLine,
  Bot,
  BookOpen,
  Award,
  type LucideIcon,
} from "lucide-react";

type NavEntry = { section: string } | { id: string; label: string; href: string; icon: LucideIcon; badge?: string };

const NAV: Record<string, NavEntry[]> = {
  ADMIN: [
    { section: "Gestão" },
    { id: "dashboard", label: "Dashboard", href: "/admin", icon: LayoutGrid },
    { id: "students", label: "Alunos", href: "/admin/students", icon: Users },
    { id: "courses", label: "Cursos", href: "/admin/courses", icon: BookOpen },
    { id: "enrollments", label: "Matrículas", href: "/admin/enrollments", icon: GraduationCap },
    { id: "plans", label: "Planos", href: "/admin/plans", icon: Tag },
    { id: "lessons", label: "Aulas", href: "/admin/lessons", icon: Calendar },
    { section: "Operação" },
    { id: "financial", label: "Financeiro", href: "/admin/financial", icon: Wallet },
    { id: "receivables", label: "Cobranças", href: "/admin/receivables", icon: Receipt },
    { id: "payroll", label: "Folha", href: "/admin/payroll", icon: Banknote },
    { id: "employees", label: "Funcionários", href: "/admin/employees", icon: UserCheck },
    { section: "Controle" },
    { id: "dre", label: "DRE", href: "/admin/dre", icon: FileBarChart },
    { id: "audit", label: "Auditoria", href: "/admin/audit", icon: ScrollText },
    { id: "users", label: "Usuários", href: "/admin/users", icon: ShieldCheck },
  ],
  STUDENT: [
    { section: "Aprender" },
    { id: "dashboard", label: "Dashboard", href: "/student", icon: LayoutGrid },
    { id: "courses", label: "Cursos", href: "/student/courses", icon: BookOpen },
    { id: "lessons", label: "Aulas", href: "/student/lessons", icon: Calendar },
    { id: "exercises", label: "Exercícios", href: "/student/exercises", icon: PenLine },
    { id: "tutor", label: "Tutor IA", href: "/student/tutor", icon: Bot, badge: "AI" },
    { section: "Conquistas" },
    { id: "certificates", label: "Certificados", href: "/student/certificates", icon: Award },
  ],
  TEACHER: [
    { section: "Ensinar" },
    { id: "dashboard", label: "Dashboard", href: "/teacher", icon: LayoutGrid },
    { id: "lessons", label: "Minhas Aulas", href: "/teacher/lessons", icon: Calendar },
    { id: "courses", label: "Catálogo", href: "/student/courses", icon: BookOpen },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  TEACHER: "Professor",
  STUDENT: "Aluno",
};

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/student" || href === "/teacher") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ previewRole, previewName }: { previewRole?: string; previewName?: string } = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { open, setOpen } = useMobileNav();
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined;
  // Em "ver como" (admin), o role/nome efetivos vêm do servidor e dirigem a navegação.
  const role = previewRole || user?.role || "STUDENT";
  const displayName = previewName ?? user?.name;
  // RBAC: admin com perfil restrito vê só as seções permitidas (null = dono = tudo).
  const sections = (user as { profileSections?: string[] | null } | undefined)?.profileSections ?? null;
  let nav = NAV[role] || NAV.STUDENT;
  if (role === "ADMIN" && sections) {
    const items = nav.filter((e) => "section" in e || adminCanAccess(sections, (e as { id: string }).id));
    // remove cabeçalhos de seção sem itens visíveis abaixo
    nav = items.filter((e, i) => !("section" in e) || (i + 1 < items.length && !("section" in items[i + 1])));
  }

  // Fecha o drawer ao trocar de rota (navegação no mobile).
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Acessibilidade do drawer mobile: fecha no Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {open && <div className="gw-backdrop" onClick={() => setOpen(false)} />}
      <aside
        className={cx("gw-sidebar", open && "gw-open")}
        aria-label="Navegação principal"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
      >
        <div className="gw-side-brand">
          <Logo variant="full" white height={38} />
        </div>

        <nav className="gw-nav-list">
          {nav.map((item, i) =>
            "section" in item ? (
              <div key={"s" + i} className="gw-nav-section">
                {item.section}
              </div>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx("gw-nav", isActive(pathname, item.href) && "active")}
              >
                <item.icon size={19} strokeWidth={isActive(pathname, item.href) ? 2 : 1.7} />
                <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: ".08em",
                      fontFamily: "var(--mono)",
                      padding: "2px 6px",
                      borderRadius: 5,
                      background: "rgba(255,255,255,.16)",
                      color: "#fff",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive(pathname, item.href) && <span className="gw-nav-dot" />}
              </Link>
            )
          )}
        </nav>

        <div className="gw-side-foot">
          <div className="gw-side-user">
            <Avatar initials={getInitials(displayName || "GW")} size={36} tone="seed" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,.55)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ROLE_LABEL[role]}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
