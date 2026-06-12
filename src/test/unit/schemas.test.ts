import { describe, it, expect } from "vitest";
import {
  CreateStudentSchema,
  CreateTransactionSchema,
  CreateEmployeeSchema,
  AiMessageSchema,
  ExerciseAttemptSchema,
} from "@/lib/schemas";

describe("CreateStudentSchema", () => {
  const valid = {
    name: "João Silva",
    email: "joao@test.com",
    password: "senha123",
  };

  it("accepts valid data", () => {
    expect(CreateStudentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects name too short", () => {
    expect(CreateStudentSchema.safeParse({ ...valid, name: "J" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(CreateStudentSchema.safeParse({ ...valid, email: "not-email" }).success).toBe(false);
  });

  it("rejects short password", () => {
    expect(CreateStudentSchema.safeParse({ ...valid, password: "123" }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(CreateStudentSchema.safeParse({}).success).toBe(false);
  });

  it("defaults level to A1", () => {
    const result = CreateStudentSchema.safeParse(valid);
    expect(result.success && (result.data as any).level).toBe("A1");
  });
});

describe("CreateTransactionSchema", () => {
  const valid = {
    type: "INCOME",
    amount: 500,
    description: "Mensalidade",
    date: "2026-06-01",
  };

  it("accepts valid income", () => {
    expect(CreateTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative amount", () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false);
  });

  it("rejects amount over 1M", () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, amount: 2_000_000 }).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, type: "OTHER" }).success).toBe(false);
  });

  it("rejects empty description", () => {
    expect(CreateTransactionSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("converte reais para centavos (500 → 50000)", () => {
    const r = CreateTransactionSchema.safeParse(valid);
    expect(r.success && r.data.amount).toBe(50000);
  });

  it("converte centavos fracionados sem erro de float (19.99 → 1999)", () => {
    const r = CreateTransactionSchema.safeParse({ ...valid, amount: 19.99 });
    expect(r.success && r.data.amount).toBe(1999);
  });
});

describe("CreateEmployeeSchema", () => {
  const valid = {
    name: "Maria Santos",
    role: "Professora",
    salary: 3000,
    startDate: "2026-01-01",
  };

  it("accepts valid data", () => {
    expect(CreateEmployeeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects zero salary", () => {
    expect(CreateEmployeeSchema.safeParse({ ...valid, salary: 0 }).success).toBe(false);
  });

  it("converte salário em reais para centavos (3000 → 300000)", () => {
    const r = CreateEmployeeSchema.safeParse(valid);
    expect(r.success && r.data.salary).toBe(300000);
  });
});

describe("AiMessageSchema", () => {
  it("accepts valid message", () => {
    expect(AiMessageSchema.safeParse({ message: "Hello!" }).success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(AiMessageSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("rejects message over 2000 chars", () => {
    expect(AiMessageSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("ExerciseAttemptSchema", () => {
  it("rejects empty exerciseId", () => {
    expect(ExerciseAttemptSchema.safeParse({ exerciseId: "", answer: "A" }).success).toBe(false);
  });
  it("accepts valid id + answer", () => {
    expect(ExerciseAttemptSchema.safeParse({ exerciseId: "u-a1-1", answer: "A" }).success).toBe(true);
  });
});
