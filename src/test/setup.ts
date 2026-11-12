import "@testing-library/jest-dom";
import { vi, afterEach } from "vitest";

// ─── Mock Prisma global ────────────────────────────────────────────────────────
// Isolação: cada teste recebe mock limpo; sem contaminação do banco real.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    studentProfile: { findUnique: vi.fn(), update: vi.fn() },
    enrollment: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    lesson: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    lessonBooking: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    financialTransaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    financialCategory: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    employee: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    salaryPayment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    exercise: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    exerciseAttempt: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    chatSession: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    chatMessage: { create: vi.fn() },
    plan: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    course: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    module: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    unit: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    coursePrerequisite: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    userUnitProgress: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    certificate: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    emailVerificationToken: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    unitMaterial: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    materialDownload: { upsert: vi.fn() },
    unitVideoProgress: { findUnique: vi.fn(), upsert: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
    accessProfile: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

// ─── Mock NextAuth ─────────────────────────────────────────────────────────────
vi.mock("next-auth", () => ({ default: vi.fn(), getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

// ─── Mock next/headers cookies ──────────────────────────────────────────────────
// getEffectiveUser() (e o evento signOut) leem/escrevem cookies; sem store de request
// real no Node de teste, cookies() lança. Stub vazio = sem preview (visão do próprio user).
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: () => {}, delete: () => {} })),
}));

// Reset de mocks após cada teste (isolação de estado)
afterEach(() => {
  vi.clearAllMocks();
});
