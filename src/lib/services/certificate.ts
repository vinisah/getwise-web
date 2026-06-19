import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { createCertificateCode } from "../tokens";
import { createNotification } from "./notifications";

interface IssueParams {
  userId: string;
  courseId: string;
  courseName: string;
  studentName: string;
}

/**
 * Emite certificado de forma idempotente (1 por [userId, courseId]).
 * Se já existe, retorna o existente — não duplica (regra de idempotência).
 */
export async function issueCertificate(params: IssueParams) {
  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId: params.userId, courseId: params.courseId } },
  });
  if (existing) return existing;

  // Gera código único com retry no próprio create (cobre a race entre check e insert).
  for (let i = 0; i < 6; i++) {
    try {
      const created = await prisma.certificate.create({
        data: {
          certificateId: createCertificateCode(),
          userId: params.userId,
          courseId: params.courseId,
          studentName: params.studentName,
          courseName: params.courseName,
          completionDate: new Date(),
        },
      });
      // Notifica o aluno só na 1ª emissão (este branch só roda na criação). Best-effort.
      await createNotification({
        userId: params.userId,
        type: "CERTIFICATE_ISSUED",
        title: "Certificado emitido 🎓",
        body: `Você concluiu ${params.courseName}. Baixe seu certificado.`,
        link: "/student/certificates",
      });
      return created;
    } catch (e) {
      // P2002 em certificateId → colisão de código: tenta de novo.
      // P2002 em [userId,courseId] → já emitido concorrentemente: retorna o existente.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined)?.join(",") ?? "";
        if (target.includes("userId") || target.includes("courseId")) {
          const existing = await prisma.certificate.findUnique({
            where: { userId_courseId: { userId: params.userId, courseId: params.courseId } },
          });
          if (existing) return existing;
        }
        continue; // colisão de certificateId → novo código
      }
      throw e;
    }
  }
  throw new Error("Falha ao gerar código único de certificado");
}

interface CertData {
  studentName: string;
  courseName: string;
  completionDate: Date;
  certificateId: string;
}

/**
 * Renderiza o certificado em PDF (paisagem A4) usando pdf-lib.
 * Retorna bytes prontos para download.
 */
export async function renderCertificatePdf(cert: CertData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape (pt)
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.086, 0.125, 0.305); // #16204E
  const accent = rgb(0.165, 0.361, 0.839); // #2A5CD6
  const muted = rgb(0.541, 0.576, 0.71);

  // Borda
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: accent,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: width - 64,
    height: height - 64,
    borderColor: navy,
    borderWidth: 0.5,
  });

  const center = (text: string, y: number, size: number, f = font, color = navy) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };

  center("GET WISE", height - 90, 18, fontBold, accent);
  center("CERTIFICADO DE CONCLUSÃO", height - 140, 30, fontBold, navy);
  center("Certificamos que", height - 200, 14, font, muted);
  center(cert.studentName, height - 245, 34, fontBold, navy);
  center("concluiu com êxito o curso", height - 295, 14, font, muted);
  center(cert.courseName, height - 335, 24, fontBold, accent);

  const dateStr = cert.completionDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  center(`Concluído em ${dateStr}`, height - 400, 13, font, navy);

  // Rodapé: ID
  page.drawText(`Certificado: ${cert.certificateId}`, {
    x: 48,
    y: 50,
    size: 10,
    font,
    color: muted,
  });
  page.drawText("getwise.com.br", {
    x: width - 48 - font.widthOfTextAtSize("getwise.com.br", 10),
    y: 50,
    size: 10,
    font,
    color: muted,
  });

  return doc.save();
}
