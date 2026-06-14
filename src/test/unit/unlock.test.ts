import { describe, it, expect, vi } from "vitest";
import { isUnitUnlocked, canAccessUnit, type OrderedUnit } from "@/lib/services/unlock";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

const ordered: OrderedUnit[] = [
  { id: "u1", moduleOrder: 1, unitOrder: 1 },
  { id: "u2", moduleOrder: 1, unitOrder: 2 },
  { id: "u3", moduleOrder: 2, unitOrder: 1 },
];

describe("isUnitUnlocked (sequencial)", () => {
  it("primeira unidade sempre desbloqueada", () => {
    expect(isUnitUnlocked("u1", ordered, new Set())).toBe(true);
  });

  it("segunda bloqueada se primeira não concluída", () => {
    expect(isUnitUnlocked("u2", ordered, new Set())).toBe(false);
  });

  it("segunda desbloqueada após concluir primeira", () => {
    expect(isUnitUnlocked("u2", ordered, new Set(["u1"]))).toBe(true);
  });

  it("terceira (próximo módulo) exige segunda concluída", () => {
    expect(isUnitUnlocked("u3", ordered, new Set(["u1"]))).toBe(false);
    expect(isUnitUnlocked("u3", ordered, new Set(["u1", "u2"]))).toBe(true);
  });

  it("unidade fora da ordenação (idx=-1) → bloqueada (seguro por padrão)", () => {
    expect(isUnitUnlocked("fantasma", ordered, new Set(["u1", "u2", "u3"]))).toBe(false);
  });
});

describe("canAccessUnit (gate de conteúdo — boundary IDOR)", () => {
  it("false quando a unidade não existe", async () => {
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce(null);
    expect(await canAccessUnit("s1", "ux")).toBe(false);
  });

  it("false quando o curso está bloqueado por pré-requisito sem certificado", async () => {
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c2", course: { isActive: true } } });
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([{ requiredCourseId: "c1" }]);
    (mockPrisma.certificate.findMany as any).mockResolvedValueOnce([]); // sem certificado do pré-req
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]);
    expect(await canAccessUnit("s1", "u1")).toBe(false);
  });

  it("true quando curso desbloqueado e é a primeira unidade", async () => {
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c1", course: { isActive: true } } });
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([]); // sem pré-req
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([{ order: 0, units: [{ id: "u1", order: 0 }] }]);
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]);
    expect(await canAccessUnit("s1", "u1")).toBe(true);
  });

  it("false quando o curso está arquivado (isActive=false)", async () => {
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c1", course: { isActive: false } } });
    expect(await canAccessUnit("s1", "u1")).toBe(false);
  });

  it("false quando curso desbloqueado mas unidade trancada (anterior não concluída)", async () => {
    (mockPrisma.unit.findUnique as any).mockResolvedValueOnce({ module: { courseId: "c1", course: { isActive: true } } });
    (mockPrisma.coursePrerequisite.findMany as any).mockResolvedValueOnce([]);
    (mockPrisma.module.findMany as any).mockResolvedValueOnce([{ order: 0, units: [{ id: "u1", order: 0 }, { id: "u2", order: 1 }] }]);
    (mockPrisma.userUnitProgress.findMany as any).mockResolvedValueOnce([]); // nada concluído
    expect(await canAccessUnit("s1", "u2")).toBe(false);
  });
});
