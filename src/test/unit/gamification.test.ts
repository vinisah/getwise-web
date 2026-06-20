import { describe, it, expect, beforeEach } from "vitest";
import { rankForXp, awardExercise, awardUnit, XP } from "@/lib/services/gamification";
import { prisma } from "@/lib/prisma";

const profile = prisma.studentProfile as unknown as {
  findUnique: ReturnType<typeof import("vitest").vi.fn>;
  update: ReturnType<typeof import("vitest").vi.fn>;
};
const attempt = prisma.exerciseAttempt as unknown as {
  count: ReturnType<typeof import("vitest").vi.fn>;
  findMany: ReturnType<typeof import("vitest").vi.fn>;
};
const exec = prisma.$executeRaw as unknown as ReturnType<typeof import("vitest").vi.fn>;

beforeEach(() => {
  // sem tentativas recentes → streak base; perfil existe
  attempt.findMany.mockResolvedValue([]);
  profile.findUnique.mockResolvedValue({ id: "p1" });
  profile.update.mockResolvedValue({});
  exec.mockResolvedValue(1);
});

describe("rankForXp", () => {
  it("faixas Bronze/Prata/Ouro/Platina", () => {
    expect(rankForXp(0)).toBe("Bronze");
    expect(rankForXp(999)).toBe("Bronze");
    expect(rankForXp(1000)).toBe("Prata");
    expect(rankForXp(4999)).toBe("Prata");
    expect(rankForXp(5000)).toBe("Ouro");
    expect(rankForXp(15000)).toBe("Platina");
  });
});

describe("awardExercise — idempotência (increment atômico)", () => {
  it("1ª aprovação → increment de XP (points) + streak; skill via $executeRaw atômico; rank na 2ª escrita", async () => {
    attempt.count.mockResolvedValueOnce(0); // nenhuma aprovação anterior
    profile.update.mockResolvedValue({ xp: 20 });
    await awardExercise("s1", "ex1", "MULTIPLE_CHOICE", 20, "att1", true);
    const first = profile.update.mock.calls[0][0].data;
    expect(first.xp).toEqual({ increment: 20 });
    expect(first.skills).toBeUndefined(); // skill não entra no update — é raw atômico
    expect(typeof first.streak).toBe("number"); // streak recomputado no caminho de exercício
    expect(profile.update.mock.calls[1][0].data.rank).toBe("Bronze"); // derivado do xp incrementado
    expect(exec).toHaveBeenCalledTimes(1); // incremento atômico do skill (jsonb_set)
  });

  it("aprovação repetida → increment 0, sem skill (sem $executeRaw)", async () => {
    attempt.count.mockResolvedValueOnce(2); // já havia aprovações
    profile.update.mockResolvedValue({ xp: 4820 });
    await awardExercise("s1", "ex1", "MULTIPLE_CHOICE", 20, "att2", true);
    expect(profile.update.mock.calls[0][0].data.xp).toEqual({ increment: 0 });
    expect(exec).not.toHaveBeenCalled();
  });

  it("tentativa reprovada → increment 0 (não consulta aprovações; sem skill)", async () => {
    profile.update.mockResolvedValue({ xp: 0 });
    await awardExercise("s1", "ex1", "MULTIPLE_CHOICE", 20, "att3", false);
    expect(attempt.count).not.toHaveBeenCalled();
    expect(profile.update.mock.calls[0][0].data.xp).toEqual({ increment: 0 });
    expect(exec).not.toHaveBeenCalled();
  });

  it("points<=0 cai no XP base do exercício", async () => {
    attempt.count.mockResolvedValueOnce(0);
    profile.update.mockResolvedValue({ xp: XP.EXERCISE_BASE });
    await awardExercise("s1", "ex1", "WRITING", 0, "att4", true);
    expect(profile.update.mock.calls[0][0].data.xp).toEqual({ increment: XP.EXERCISE_BASE });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("sem perfil de aluno → no-op (não lança, não atualiza)", async () => {
    profile.findUnique.mockResolvedValueOnce(null);
    attempt.count.mockResolvedValueOnce(0);
    await awardExercise("s1", "ex1", "MULTIPLE_CHOICE", 20, "att5", true);
    expect(profile.update).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
  });
});

describe("awardUnit — não mexe no streak nem skill", () => {
  it("increment de XP de unidade, sem campo streak, sem skill raw", async () => {
    profile.update.mockResolvedValue({ xp: XP.UNIT });
    await awardUnit("s1");
    const first = profile.update.mock.calls[0][0].data;
    expect(first.xp).toEqual({ increment: XP.UNIT });
    expect(first.streak).toBeUndefined();
    expect(exec).not.toHaveBeenCalled();
  });
});
