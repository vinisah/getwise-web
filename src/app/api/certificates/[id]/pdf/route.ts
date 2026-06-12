import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { renderCertificatePdf } from "@/lib/services/certificate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/certificates/[id]/pdf — gera e baixa o PDF do certificado.
 * Acesso: dono do certificado ou admin (least privilege).
 */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx as Ctx).params;

  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) return NextResponse.json({ error: "Certificado não encontrado" }, { status: 404 });

  // Guard: dono ou admin
  if (session.user.role !== "ADMIN" && cert.userId !== session.user.id) {
    throw new ApiError(403, "Acesso negado");
  }

  const pdf = await renderCertificatePdf({
    studentName: cert.studentName,
    courseName: cert.courseName,
    completionDate: cert.completionDate,
    certificateId: cert.certificateId,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${cert.certificateId}.pdf"`,
    },
  });
});
