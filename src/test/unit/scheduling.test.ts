import { describe, expect, it } from "vitest";
import { assertAvailable, CohortInput, ResponseInput, weeklyDates } from "@/lib/scheduling/rules";
describe("Regras da agenda", () => {
  it("rejeita remarcação entre níveis diferentes", () => {
    expect(() => assertAvailable("A1", "A2", 10, 2)).toThrow("mesmo nível");
  });
  it("rejeita a última vaga já ocupada", () => {
    expect(() => assertAvailable("A1", "A1", 8, 8)).toThrow("lotada");
    expect(() => assertAvailable("A1", "A1", 8, 7)).not.toThrow();
  });
  it("gera 50 encontros semanais mantendo o horário", () => {
    const dates = weeklyDates("2026-12-01T19:00:00-03:00", 50);
    expect(dates).toHaveLength(50);
    expect(dates[49].getTime() - dates[0].getTime()).toBe(49 * 7 * 86400000);
    expect(dates.every((date) => date.getUTCHours() === 22)).toBe(true);
  });
  it("exige justificativa para ausência", () => {
    expect(ResponseInput.safeParse({ action: "decline", bookingId: "b", reason: " " }).success).toBe(false);
  });
  it("aceita conteúdo A3 e impede capacidade inválida", () => {
    const input = { name: "Turma A3", title: "Prática", level: "A3", capacity: 8, teacherId: "t", startsAt: "2026-12-01T19:00:00-03:00", weeks: 50, duration: 50 };
    expect(CohortInput.safeParse(input).success).toBe(true);
    expect(CohortInput.safeParse({ ...input, capacity: 0 }).success).toBe(false);
  });
});
