import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNavProvider } from "@/components/dashboard/mobile-nav";
import { getEffectiveUser } from "@/lib/effective-user";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Sessão sem user = conta desativada/inválida (ver callback session em lib/auth.ts).
  if (!session?.user) {
    redirect("/login");
  }

  // Visão de papel (admin): quando o admin está "vendo como" aluno/professor pelo seletor
  // do topbar, o role/nome efetivos dirigem a navegação.
  const eff = await getEffectiveUser();
  const previewRole = eff?.isPreview ? eff.role : undefined;
  const previewName = eff?.isPreview ? eff.name : undefined;

  return (
    <MobileNavProvider>
      <div className="gw-app">
        <Sidebar previewRole={previewRole} previewName={previewName} />
        <main className="gw-main">
          <Topbar previewRole={previewRole} />
          <div className="gw-content">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
