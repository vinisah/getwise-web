import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fmtCents } from "../money";
import { PAYMENT_TYPE_LABEL, type SalaryPaymentType } from "../payroll";

/**
 * Recibos em PDF (A5 paisagem) — mensalidade do aluno e holerite simplificado.
 * Mesmo visual do certificado: marinho #16204E + azul #2A5CD6.
 */

const navy = rgb(0.086, 0.125, 0.305);
const accent = rgb(0.165, 0.361, 0.839);
const muted = rgb(0.541, 0.576, 0.71);

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

async function basePage() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 420]); // A5 landscape (pt)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 16, y: 16, width: width - 32, height: height - 32, borderColor: accent, borderWidth: 1.5 });
  page.drawText("GET WISE", { x: 32, y: height - 48, size: 16, font: fontBold, color: accent });
  page.drawText("getwise.com.br", {
    x: width - 32 - font.widthOfTextAtSize("getwise.com.br", 9),
    y: height - 46, size: 9, font, color: muted,
  });

  return { doc, page, font, fontBold, width, height };
}

interface ReceiptLine {
  label: string;
  value: string;
  bold?: boolean;
}

async function renderLines(title: string, subtitle: string, lines: ReceiptLine[], footer: string): Promise<Uint8Array> {
  const { doc, page, font, fontBold, width, height } = await basePage();

  page.drawText(title, { x: 32, y: height - 84, size: 18, font: fontBold, color: navy });
  page.drawText(subtitle, { x: 32, y: height - 102, size: 10, font, color: muted });

  let y = height - 140;
  for (const line of lines) {
    const f = line.bold ? fontBold : font;
    page.drawText(line.label, { x: 48, y, size: 11, font: f, color: line.bold ? navy : muted });
    const w = f.widthOfTextAtSize(line.value, 11);
    page.drawText(line.value, { x: width - 48 - w, y, size: 11, font: f, color: navy });
    y -= line.bold ? 26 : 20;
  }

  page.drawLine({ start: { x: 48, y: y + 8 }, end: { x: width - 48, y: y + 8 }, thickness: 0.5, color: muted });
  page.drawText(footer, { x: 32, y: 36, size: 8.5, font, color: muted });

  return doc.save();
}

export interface TuitionReceiptData {
  paymentId: string;
  studentName: string;
  planName: string | null;
  month: number;
  year: number;
  amount: number; // centavos
  paidAt: Date | null;
  method: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito", BOLETO: "Boleto",
};

/** Recibo de mensalidade paga. */
export async function renderTuitionReceiptPdf(d: TuitionReceiptData): Promise<Uint8Array> {
  const ref = `${String(d.month).padStart(2, "0")}/${d.year}`;
  return renderLines(
    "RECIBO DE PAGAMENTO",
    `Mensalidade — competência ${ref}`,
    [
      { label: "Aluno", value: d.studentName },
      { label: "Plano", value: d.planName ?? "—" },
      { label: "Competência", value: ref },
      { label: "Forma de pagamento", value: d.method ? METHOD_LABEL[d.method] ?? d.method : "Não informado" },
      { label: "Data do pagamento", value: d.paidAt ? fmtDate(d.paidAt) : "—" },
      { label: "Valor pago", value: fmtCents(d.amount), bold: true },
    ],
    `Recibo ${d.paymentId} — emitido em ${fmtDate(new Date())}. Documento sem valor fiscal.`
  );
}

export interface PayslipData {
  salaryPaymentId: string;
  employeeName: string;
  employeeRole: string;
  type: SalaryPaymentType;
  month: number;
  year: number;
  grossAmount: number;
  inssAmount: number;
  irrfAmount: number;
  fgtsAmount: number;
  netAmount: number;
  paidAt: Date | null;
}

/** Holerite simplificado (demonstrativo de pagamento). */
export async function renderPayslipPdf(d: PayslipData): Promise<Uint8Array> {
  const ref = `${String(d.month).padStart(2, "0")}/${d.year}`;
  const lines: ReceiptLine[] = [
    { label: "Funcionário", value: d.employeeName },
    { label: "Cargo", value: d.employeeRole },
    { label: "Competência", value: ref },
    { label: `Vencimento (${PAYMENT_TYPE_LABEL[d.type]})`, value: fmtCents(d.grossAmount) },
  ];
  // hífen ASCII: Helvetica (WinAnsi) não codifica o sinal de menos U+2212
  if (d.inssAmount > 0) lines.push({ label: "INSS (desconto)", value: `- ${fmtCents(d.inssAmount)}` });
  if (d.irrfAmount > 0) lines.push({ label: "IRRF (desconto)", value: `- ${fmtCents(d.irrfAmount)}` });
  lines.push({ label: "Valor líquido", value: fmtCents(d.netAmount), bold: true });
  if (d.fgtsAmount > 0) lines.push({ label: "FGTS depositado (não descontado)", value: fmtCents(d.fgtsAmount) });
  if (d.paidAt) lines.push({ label: "Data do pagamento", value: fmtDate(d.paidAt) });

  return renderLines(
    "DEMONSTRATIVO DE PAGAMENTO",
    `${PAYMENT_TYPE_LABEL[d.type]} — competência ${ref}`,
    lines,
    `Demonstrativo ${d.salaryPaymentId} — emitido em ${fmtDate(new Date())}. Estimativa gerencial, sem valor fiscal.`
  );
}
