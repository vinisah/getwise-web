import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Badge, SectionHeader } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Award, Download } from "lucide-react";

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string } | undefined;
  if (!user) redirect("/login");

  const certificates = await prisma.certificate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { level: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <SectionHeader title="Seus certificados" sub="Conclua cursos para conquistar certificados" />

      {certificates.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <Award size={40} color="var(--muted)" style={{ margin: "0 auto 16px" }} />
          <p style={{ fontSize: 14, color: "var(--muted)" }}>Você ainda não tem certificados.</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Conclua todas as unidades de um curso para emitir o seu.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "var(--gap)" }}>
          {certificates.map((cert) => (
            <Card key={cert.id} style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "3px solid var(--accent)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Award size={26} />
                </div>
                <Badge tone="slate">{cert.course.level}</Badge>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{cert.courseName}</h3>
                <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                  Emitido em {formatDate(cert.completionDate)} · {cert.certificateId}
                </p>
              </div>
              <a href={`/api/certificates/${cert.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Button variant="accent" style={{ width: "100%" }}><Download size={16} /> Baixar PDF</Button>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
