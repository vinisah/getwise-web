import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfilesManager } from "./profiles-manager";

export default async function ProfilesPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const profiles = await prisma.accessProfile.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Perfis definem quais seções do painel cada usuário ADMIN enxerga. Quem não tem perfil é dono (acesso total).
        </p>
      </div>

      <ProfilesManager
        initial={profiles.map((p) => ({
          id: p.id,
          name: p.name,
          sections: p.sections,
          isSystem: p.isSystem,
          users: p._count.users,
        }))}
      />
    </div>
  );
}
