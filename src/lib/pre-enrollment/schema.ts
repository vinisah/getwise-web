import { z } from "zod";

export function todayInSchool(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((k) => parts.find((p) => p.type === k)!.value).join("-");
}
export function isMinor(birthDate: string, today = todayInSchool()) {
  const birthday18 = `${Number(birthDate.slice(0, 4)) + 18}${birthDate.slice(4)}`;
  return birthday18 > today;
}

/** Primeiro instante do dia civil da escola, inclusive em mudanças históricas de offset. */
export function schoolDayStart(date: string) {
  const center = Date.parse(`${date}T00:00:00Z`);
  let low = center - 36 * 3600000;
  let high = center + 36 * 3600000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (todayInSchool(new Date(mid)) < date) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}
export function validCpf(value: string) {
  const s = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(s) || /^(\d)\1+$/.test(s)) return false;
  return [9, 10].every((n) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(s[i]) * (n + 1 - i);
    const digit = (sum * 10) % 11;
    return Number(s[n]) === (digit === 10 ? 0 : digit);
  });
}
const text = z.string().trim().max(200);
const required = text.min(1, "Preencha este campo.");
const date = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s &&
      s <= todayInSchool() &&
      s >= "1900-01-01",
    "Informe uma data de nascimento válida."
  );
export const PersonSchema = z.object({
  name: required.min(3, "Informe o nome completo."),
  cpf: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine(validCpf, "Confira os dígitos do CPF."),
  birthDate: date,
  gender: required,
  maritalStatus: required,
  profession: required,
  workplace: required,
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => /^\d{10,13}$/.test(s), "Informe telefone com DDD."),
  email: z.union([z.email("Informe um e-mail válido."), z.literal("")]).transform((s) => s.toLowerCase()),
  zipCode: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => /^\d{8}$/.test(s), "Informe um CEP com 8 dígitos."),
  address: required,
  number: required,
  neighborhood: required,
});
export const ApplicationSchema = z
  .object({
    schoolUnitId: required,
    courseId: required,
    consultant: required,
    student: PersonSchema,
    guardian: PersonSchema.nullable(),
    relationship: text,
    allergies: z.enum(["YES", "NO"]),
    allergyDetails: z.string().trim().max(2000),
    learningNeeds: z.string().trim().max(2000),
    source: required,
    favorite: required,
  })
  .superRefine((v, ctx) => {
    if (isMinor(v.student.birthDate)) {
      if (!v.guardian)
        ctx.addIssue({ code: "custom", path: ["guardian", "name"], message: "Informe os dados do responsável." });
      else {
        if (isMinor(v.guardian.birthDate))
          ctx.addIssue({
            code: "custom",
            path: ["guardian", "birthDate"],
            message: "O responsável deve ter 18 anos ou mais.",
          });
        if (!v.guardian.email)
          ctx.addIssue({ code: "custom", path: ["guardian", "email"], message: "Informe o e-mail do responsável." });
        if (v.guardian.cpf === v.student.cpf)
          ctx.addIssue({
            code: "custom",
            path: ["guardian", "cpf"],
            message: "Informe o CPF do responsável, diferente do aluno.",
          });
      }
      if (!v.relationship)
        ctx.addIssue({ code: "custom", path: ["relationship"], message: "Informe o vínculo com o aluno." });
    } else if (!v.student.email)
      ctx.addIssue({ code: "custom", path: ["student", "email"], message: "Informe seu e-mail de acesso." });
    if (v.allergies === "YES" && !v.allergyDetails)
      ctx.addIssue({ code: "custom", path: ["allergyDetails"], message: "Descreva a alergia do aluno." });
  });
export const SubmissionSchema = z.object({
  data: ApplicationSchema,
  password: z.string().min(8, "Use uma senha com pelo menos 8 caracteres.").max(72),
  requestId: z.uuid(),
});
export type ApplicationData = z.infer<typeof ApplicationSchema>;
export type PersonData = z.infer<typeof PersonSchema>;
export const emptyPerson: PersonData = {
  name: "",
  cpf: "",
  birthDate: "",
  gender: "",
  maritalStatus: "",
  profession: "",
  workplace: "",
  phone: "",
  email: "",
  zipCode: "",
  address: "",
  number: "",
  neighborhood: "",
};
export const emptyApplication: ApplicationData = {
  schoolUnitId: "",
  courseId: "",
  consultant: "Secretaria",
  student: { ...emptyPerson },
  guardian: null,
  relationship: "",
  allergies: "NO",
  allergyDetails: "",
  learningNeeds: "",
  source: "",
  favorite: "",
};
export const statusLabels: Record<string, string> = {
  PLACEMENT_PENDING: "Aguardando direção",
  PLACEMENT_AUTHORIZED: "Exceção autorizada",
  PLACEMENT_REJECTED: "Exceção recusada",
  PENDING: "Em análise",
  CORRECTION: "Ajustes solicitados",
  APPROVED: "Aprovada para matrícula",
  REJECTED: "Não aprovada",
  ENROLLED: "Matrícula efetivada",
};
export const SchoolUnitSchema = z.object({
  code: required,
  name: required,
  legalName: required,
  cnpj: text,
  zipCode: text,
  address: text,
  number: text,
  complement: text,
  neighborhood: text,
  city: required,
  state: z.string().length(2),
  phone: text,
  mobile: text,
  email: z.email(),
  classification: text,
  notes: z.string().max(4000),
  isActive: z.boolean(),
  enrollmentOpen: z.boolean(),
  consultants: z.array(required).max(50),
  courseIds: z.array(required).max(200),
  logoUrl: z.union([z.url().refine((s) => s.startsWith("https://"), "Use um endereço HTTPS."), z.literal("")]),
  photos: z.array(z.url().refine((s) => s.startsWith("https://"))).max(20),
  partners: z
    .array(
      z.object({
        name: required,
        birthDate: z.union([date, z.literal("")]),
        document: text,
        photoUrl: z.union([z.url().refine((s) => s.startsWith("https://")), z.literal("")]),
      })
    )
    .max(30),
});
