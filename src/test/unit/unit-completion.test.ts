import { describe, it, expect, vi } from "vitest";
import { checkRequiredExercises } from "@/lib/services/unit-completion";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

describe("checkRequiredExercises", () => {
  it("sem exercícios obrigatórios → allPassed true", async () => {
    (mockPrisma.exercise.findMany as any).mockResolvedValueOnce([]);
    const r = await checkRequiredExercises("u1", "unit1");
    expect(r.allPassed).toBe(true);
    expect(r.requiredTotal).toBe(0);
  });

  it("nem todos aprovados → allPassed false", async () => {
    (mockPrisma.exercise.findMany as any).mockResolvedValueOnce([{ id: "e1" }, { id: "e2" }]);
    (mockPrisma.exerciseAttempt.findMany as any).mockResolvedValueOnce([{ exerciseId: "e1" }]);
    const r = await checkRequiredExercises("u1", "unit1");
    expect(r.allPassed).toBe(false);
    expect(r.requiredPassed).toBe(1);
    expect(r.requiredTotal).toBe(2);
  });

  it("todos aprovados → allPassed true", async () => {
    (mockPrisma.exercise.findMany as any).mockResolvedValueOnce([{ id: "e1" }, { id: "e2" }]);
    (mockPrisma.exerciseAttempt.findMany as any).mockResolvedValueOnce([{ exerciseId: "e1" }, { exerciseId: "e2" }]);
    const r = await checkRequiredExercises("u1", "unit1");
    expect(r.allPassed).toBe(true);
    expect(r.requiredPassed).toBe(2);
  });
});
