import { z } from "zod";
import { reaisToCents } from "./money";

// ─── Reutilizáveis ───────────────────────────────────────────────────────────

const CEFRLevel = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

const BrazilianPhone = z.string().max(20).optional();
const CPF = z.string().max(14).optional();
// Recebe reais (unidade humana), devolve centavos (Int) para armazenamento.
const BrlAmount = z.coerce
  .number()
  .positive()
  .max(1_000_000, "Valor máximo: R$ 1.000.000")
  .transform(reaisToCents);

// Datas vêm como string (input/JSON). Validar parse evita `new Date("lixo")` → Invalid Date → 500.
const DateString = z.string().min(1, "Data obrigatória").refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida");
const OptionalDateString = z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Data inválida").optional();

// ─── Alunos ──────────────────────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
  phone: BrazilianPhone,
  cpf: CPF,
  birthDate: OptionalDateString,
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().length(2, "Informe a UF com 2 letras (ex.: SP)").optional().or(z.literal("")),
  zipCode: z.string().max(9).optional(),
  level: CEFRLevel.default("A1"),
  emergencyContact: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Matrículas ───────────────────────────────────────────────────────────────

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().min(1, "ID inválido"),
  planId: z.string().min(1, "ID inválido"),
  startDate: DateString,
  // reais → centavos (Int)
  discount: z.coerce.number().min(0).max(10_000).transform(reaisToCents).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Planos ──────────────────────────────────────────────────────────────────

export const CreatePlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: BrlAmount,
  lessonsPerMonth: z.coerce.number().int().min(1).max(50),
  lessonDurationMin: z.coerce.number().int().min(15).max(180).default(50),
  features: z.array(z.string()).optional(),
});

// ─── Aulas ────────────────────────────────────────────────────────────────────

export const CreateLessonSchema = z.object({
  title: z.string().min(2).max(200),
  teacherId: z.string().optional(),
  description: z.string().max(1000).optional(),
  scheduledAt: DateString,
  duration: z.coerce.number().int().min(15).max(180).default(50),
  meetingUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  level: CEFRLevel.default("A1"),
  maxStudents: z.coerce.number().int().min(1).max(30).default(1),
  studentIds: z.array(z.string().min(1)).optional(),
  notes: z.string().max(1000).optional(),
});

// Edição de aula — campos opcionais; status restrito às transições seguras.
export const UpdateLessonSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(1000).optional(),
    scheduledAt: OptionalDateString,
    duration: z.coerce.number().int().min(15).max(180).optional(),
    meetingUrl: z.string().url("URL inválida").optional().or(z.literal("")),
    level: CEFRLevel.optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Nada a atualizar" });

// ─── Funcionários ─────────────────────────────────────────────────────────────

export const CreateEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  role: z.string().min(2).max(100),
  salary: BrlAmount,
  contractType: z.enum(["CLT", "PJ", "HOURLY"]).default("CLT"),
  dependents: z.coerce.number().int().min(0).max(20).default(0),
  startDate: DateString,
  email: z.string().email().optional().or(z.literal("")),
  phone: BrazilianPhone,
  cpf: CPF,
  notes: z.string().max(1000).optional(),
});

// ─── Financeiro ───────────────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: BrlAmount,
  description: z.string().min(1).max(200),
  date: DateString,
  dueDate: OptionalDateString,
  categoryId: z.string().optional(),
  isPaid: z.boolean().or(z.enum(["true", "false"]).transform((v) => v === "true")).default(false),
  isRecurring: z.boolean().or(z.enum(["true", "false"]).transform((v) => v === "true")).default(false),
  paymentMethod: z
    .enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"])
    .optional(),
  // Bloqueia colisão com namespaces internos reservados (payment:/salary:/recurring:/enrollment:).
  reference: z
    .string()
    .max(100)
    .refine((v) => !/^(payment|salary|recurring|enrollment):/i.test(v), "Prefixo de referência reservado")
    .optional(),
  notes: z.string().max(1000).optional(),
  userId: z.string().optional(),
});

// Edição de transação — todos os campos opcionais.
// isPaid é redefinido SEM .default(false): com partial(), o default dispararia em
// undefined e marcaria a transação como não-paga a cada edição que omitisse o campo.
export const UpdateTransactionSchema = CreateTransactionSchema.partial().extend({
  isPaid: z.boolean().or(z.enum(["true", "false"]).transform((v) => v === "true")).optional(),
  isRecurring: z.boolean().or(z.enum(["true", "false"]).transform((v) => v === "true")).optional(),
  // Edição reenvia o reference já-existente (inclusive os internos payment:/salary:/recurring:).
  // O guard de prefixo reservado vale só na CRIAÇÃO (input humano) — sem ele aqui, senão
  // recategorizar uma despesa recorrente/mensalidade/folha quebraria com 400.
  reference: z.string().max(100).optional(),
});

// Filtro de período (query params chegam como string).
export const MonthYearQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
});

// ─── Pagamento de Salário (folha) ────────────────────────────────────────────────

export const CreateSalaryPaymentSchema = z.object({
  employeeId: z.string().min(1, "ID inválido"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  // Tipo da parcela — o servidor calcula descontos/encargos conforme o tipo.
  type: z.enum(["SALARY", "THIRTEENTH_1", "THIRTEENTH_2", "VACATION", "OTHER"]).default("SALARY"),
  // Bruto em reais → centavos. Default: salário cadastrado do funcionário.
  grossAmount: BrlAmount.optional(),
  isPaid: z.boolean().or(z.enum(["true", "false"]).transform((v) => v === "true")).default(true),
  notes: z.string().max(1000).optional(),
});

// ─── Mensalidades (Payment) ──────────────────────────────────────────────────────

export const MarkPaymentSchema = z.object({
  status: z.enum(["PAID", "PENDING"]),
  method: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"]).optional(),
});

// ─── Reajuste de Planos ──────────────────────────────────────────────────────────

export const AdjustPlansSchema = z.object({
  // % de reajuste sobre todos os planos ativos (negativo = redução)
  percent: z.coerce.number().min(-50, "Mínimo −50%").max(100, "Máximo 100%"),
});

// ─── Gestão de Usuários ──────────────────────────────────────────────────────────

export const UpdateUserSchema = z
  .object({
    role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
    isActive: z.boolean().optional(),
    // Senha temporária definida pelo admin (usuário troca depois).
    password: z.string().min(6, "Mínimo 6 caracteres").max(100).optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined || d.password !== undefined, {
    message: "Nada a atualizar",
  });

// ─── Recorrência ─────────────────────────────────────────────────────────────────

export const GenerateRecurringSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

// ─── Exercícios ───────────────────────────────────────────────────────────────

const ExerciseTypeEnum = z.enum([
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE",
  "WRITING",
  "LISTENING",
  "WORD_MATCH",
  "TRANSLATION",
  "SENTENCE_ORDER",
  "DICTATION",
  "PRONUNCIATION",
]);

// Tipos corrigidos automaticamente → exigem correctAnswer (senão exercício insolúvel).
const AUTO_GRADED = new Set(["MULTIPLE_CHOICE", "FILL_IN_BLANK", "TRUE_FALSE", "WORD_MATCH", "TRANSLATION", "SENTENCE_ORDER"]);

export const CreateExerciseSchema = z
  .object({
    title: z.string().min(2).max(200),
    type: ExerciseTypeEnum,
    level: CEFRLevel.default("A1"),
    content: z.record(z.string(), z.unknown()),
    correctAnswer: z.unknown().optional(),
    explanation: z.string().max(1000).optional(),
    description: z.string().max(500).optional(),
    points: z.coerce.number().int().min(1).max(100).default(10),
    timeLimit: z.coerce.number().int().min(10).max(3600).optional(),
    lessonId: z.string().optional(),
    unitId: z.string().optional(),
    isRequired: z.boolean().default(true),
    order: z.coerce.number().int().min(0).max(999).default(0),
  })
  .superRefine((d, ctx) => {
    if (AUTO_GRADED.has(d.type) && (d.correctAnswer === undefined || d.correctAnswer === null || d.correctAnswer === "")) {
      ctx.addIssue({ code: "custom", path: ["correctAnswer"], message: `correctAnswer é obrigatório para ${d.type}` });
    }
  });

export const VideoProgressSchema = z.object({
  positionSeconds: z.coerce.number().int().min(0).max(86400),
  watchedPercent: z.coerce.number().int().min(0).max(100),
});

export const ExerciseAttemptSchema = z.object({
  exerciseId: z.string().min(1, "ID inválido"),
  answer: z.unknown(),
  timeSpent: z.coerce.number().int().min(0).max(7200).optional(),
});

// ─── IA ───────────────────────────────────────────────────────────────────────

export const AiMessageSchema = z.object({
  message: z.string().min(1, "Mensagem vazia").max(2000, "Mensagem muito longa"),
  // nullish: aceita string, null (1ª msg) ou undefined
  sessionId: z.string().nullish(),
});

// ─── Categorias Financeiras ───────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});

// ─── Auth (cadastro / recuperação de senha) ────────────────────────────────────

export const RegisterSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10, "Token inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

// ─── Cursos / Módulos / Unidades ───────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  level: CEFRLevel,
  coverImage: z.string().url().optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

// .partial() NÃO remove .default() — sem o override abaixo, um PUT de {isActive} injetaria
// order:0/isActive:true e a rota gravaria (clobber). Redefine sem default.
export const UpdateCourseSchema = CreateCourseSchema.partial().extend({
  order: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export const CreateModuleSchema = z.object({
  courseId: z.string().min(1, "ID inválido"),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  order: z.coerce.number().int().min(0).max(999).default(0),
});

export const UpdateModuleSchema = CreateModuleSchema.partial().omit({ courseId: true }).extend({
  order: z.coerce.number().int().min(0).max(999).optional(), // sem default herdado (anti-clobber)
});

export const CreateUnitSchema = z.object({
  moduleId: z.string().min(1, "ID inválido"),
  title: z.string().min(2).max(200),
  content: z.string().max(50_000).default(""),
  type: z.enum(["READING", "VIDEO", "MIXED"]).default("READING"),
  videoUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  videoDurationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  order: z.coerce.number().int().min(0).max(999).default(0),
});

export const UpdateUnitSchema = CreateUnitSchema.partial().omit({ moduleId: true }).extend({
  // sem defaults herdados (content/type/order) — evitaria clobber em edição parcial.
  content: z.string().max(50_000).optional(),
  type: z.enum(["READING", "VIDEO", "MIXED"]).optional(),
  order: z.coerce.number().int().min(0).max(999).optional(),
});

export const CreateMaterialSchema = z.object({
  unitId: z.string().min(1, "ID inválido"),
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().url("URL inválida"),
  fileType: z.string().max(20).default("pdf"),
});

export const CoursePrereqSchema = z.object({
  requiredCourseId: z.string().min(1, "ID inválido"),
});

export const CompleteUnitSchema = z.object({
  unitId: z.string().min(1, "ID inválido"),
});
