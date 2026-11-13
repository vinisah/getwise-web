import { describe, expect, it } from "vitest";
import { CreateLessonSchema, UpdateLessonSchema } from "@/lib/schemas";
import { schoolDateTimeInput } from "@/lib/scheduling/dates";
import { CohortInput, overlaps } from "@/lib/scheduling/rules";

describe("Horários da agenda", () => {
  it("cadastro manual e edição interpretam o relógio como Brasília", () => {
    const input = "2036-02-02T19:00";
    const created = CreateLessonSchema.parse({ title: "Aula", scheduledAt: input });
    const edited = UpdateLessonSchema.parse({ scheduledAt: input });
    expect(new Date(created.scheduledAt).toISOString()).toBe("2036-02-02T22:00:00.000Z");
    expect(edited.scheduledAt).toBe(created.scheduledAt);
  });
  it("abrir e salvar uma aula não desloca três horas", () => {
    const stored = new Date("2036-02-03T01:30:00.000Z");
    const input = schoolDateTimeInput(stored);
    expect(input).toBe("2036-02-02T22:30");
    expect(new Date(UpdateLessonSchema.parse({ scheduledAt: input }).scheduledAt!).getTime()).toBe(stored.getTime());
  });
  it("data impossível é rejeitada", () => {
    expect(UpdateLessonSchema.safeParse({ scheduledAt: "2036-02-31T19:00" }).success).toBe(false);
  });
  it("formulário de turmas aceita minutos com offset explícito", () => {
    expect(
      CohortInput.safeParse({
        name: "Turma",
        title: "Aula",
        teacherId: "t",
        level: "A1",
        capacity: 4,
        duration: 50,
        weeks: 4,
        startsAt: "2036-02-02T19:00-03:00",
      }).success
    ).toBe(true);
  });
  it("aulas consecutivas podem encostar, mas não sobrepor", () => {
    const a = { scheduledAt: new Date("2036-02-02T22:00:00Z"), duration: 50 };
    expect(overlaps(a, { scheduledAt: new Date("2036-02-02T22:50:00Z"), duration: 50 })).toBe(false);
    expect(overlaps(a, { scheduledAt: new Date("2036-02-02T22:49:00Z"), duration: 50 })).toBe(true);
  });
});
