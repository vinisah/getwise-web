import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/gw/logo";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, GraduationCap } from "lucide-react";

export const metadata = {
  title: "Verificar certificado · Get Wise",
  robots: { index: false },
};

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante",
  A2: "A2 — Básico",
  B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado",
  C1: "C1 — Avançado",
  C2: "C2 — Proficiente",
};

/**
 * Verificação PÚBLICA de certificado (sem auth, read-only).
 * Fora de (auth)/(dashboard) → o proxy.ts deixa passar. Valida pelo Certificate.certificateId.
 */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { certificateId: code },
    include: { course: { select: { level: true } } },
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 22,
      }}
    >
      <Link href="/login" aria-label="Get Wise">
        <Logo variant="full" height={34} />
      </Link>

      <div className="gw-card" style={{ width: "100%", maxWidth: 460, padding: 32, textAlign: "center" }}>
        {cert ? (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--success) 14%, transparent)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={34} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>
              Certificado válido
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Emitido pela Get Wise</p>

            <div style={{ marginTop: 22, textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Aluno" value={cert.studentName} />
              <Field label="Curso" value={cert.courseName} sub={LEVEL_LABELS[cert.course.level] ?? cert.course.level} />
              <Field label="Concluído em" value={formatDate(cert.completionDate)} />
              <Field label="Código" value={cert.certificateId} mono />
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--danger) 14%, transparent)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <XCircle size={34} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>
              Certificado não encontrado
            </h1>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}>
              O código <b style={{ color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{code}</b> não corresponde a
              nenhum certificado emitido. Confira se digitou corretamente.
            </p>
          </>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <GraduationCap size={14} /> getwise.com.br · verificação de certificados
      </p>
    </div>
  );
}

function Field({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        borderBottom: "1px solid var(--line)",
        paddingBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--mono)",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", fontFamily: mono ? "var(--mono)" : undefined }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{sub}</span>}
    </div>
  );
}
