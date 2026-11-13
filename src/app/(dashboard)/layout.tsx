import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNavProvider } from "@/components/dashboard/mobile-nav";
import { getCachedSession, getEffectiveUser } from "@/lib/effective-user";
import { prisma } from "@/lib/prisma";
import { normalizePrefs } from "@/lib/theme";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession();

  // Sessão sem user = conta desativada/inválida (ver callback session em lib/auth.ts).
  if (!session?.user) {
    redirect("/login");
  }

  // Visão de papel (admin): quando o admin está "vendo como" aluno/professor pelo seletor
  // do topbar, o role/nome efetivos dirigem a navegação.
  const eff = await getEffectiveUser();
  const previewRole = eff?.isPreview ? eff.role : undefined;
  const previewName = eff?.isPreview ? eff.name : undefined;
  const ownAccount = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } });

  return (
    <PreferencesProvider key={session.user.id} initialPrefs={normalizePrefs(ownAccount?.uiPrefs)}>
      <MobileNavProvider>
        <div className="gw-app">
          <Sidebar previewRole={previewRole} previewName={previewName} />
          <main className="gw-main">
            <Topbar previewRole={previewRole} />
            <div className="gw-content">{children}</div>
          </main>
        </div>
      </MobileNavProvider>
    </PreferencesProvider>
  );
}
