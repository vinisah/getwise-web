import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNavProvider } from "@/components/dashboard/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <MobileNavProvider>
      <div className="gw-app">
        <Sidebar />
        <main className="gw-main">
          <Topbar />
          <div className="gw-content">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
