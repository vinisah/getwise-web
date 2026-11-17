import { describe, it, expect } from "vitest";
import { ApplicationSchema, isMinor, validCpf, todayInSchool, schoolDayStart } from "@/lib/pre-enrollment/schema";
import { adultApplication } from "@/test/fixtures/pre-enrollment";
describe("pré-matrícula: regras do formulário", () => {
  it("filtro usa o primeiro instante do dia na escola, incluindo horário de verão histórico", () => {
    expect(schoolDayStart("2026-11-17").toISOString()).toBe("2026-11-17T03:00:00.000Z");
    expect(schoolDayStart("2018-11-04").toISOString()).toBe("2018-11-04T03:00:00.000Z");
  });
  it("considera os 18 anos completos na data da escola", () => {
    expect(isMinor("2008-11-17", "2026-11-17")).toBe(false);
    expect(isMinor("2008-11-18", "2026-11-17")).toBe(true);
    expect(todayInSchool(new Date("2026-11-18T01:00:00Z"))).toBe("2026-11-17");
  });
  it("valida dígitos de CPF e remove máscara", () => {
    expect(validCpf("529.982.247-25")).toBe(true);
    expect(validCpf("52998224726")).toBe(false);
    expect(validCpf("11111111111")).toBe(false);
    expect(
      ApplicationSchema.parse({ ...adultApplication, student: { ...adultApplication.student, cpf: "529.982.247-25" } })
        .student.cpf
    ).toBe("52998224725");
  });
  it("recusa datas inexistentes e futuras", () => {
    for (const birthDate of ["2026-02-31", "2999-01-01", "abc"])
      expect(
        ApplicationSchema.safeParse({ ...adultApplication, student: { ...adultApplication.student, birthDate } })
          .success
      ).toBe(false);
  });
  it("exige responsável para menor, com email e idade adulta", () => {
    const minor = { ...adultApplication, student: { ...adultApplication.student, birthDate: "2015-01-01", email: "" } };
    expect(ApplicationSchema.safeParse(minor).success).toBe(false);
    expect(
      ApplicationSchema.safeParse({
        ...minor,
        relationship: "Mãe",
        guardian: { ...adultApplication.student, cpf: "11144477735" },
      }).success
    ).toBe(true);
    expect(
      ApplicationSchema.safeParse({
        ...minor,
        relationship: "Mãe",
        guardian: { ...adultApplication.student, cpf: "11144477735", birthDate: "2010-01-01" },
      }).success
    ).toBe(false);
  });
  it("adulto precisa de email, e alergia positiva de descrição", () => {
    expect(
      ApplicationSchema.safeParse({ ...adultApplication, student: { ...adultApplication.student, email: "" } }).success
    ).toBe(false);
    expect(ApplicationSchema.safeParse({ ...adultApplication, allergies: "YES" }).success).toBe(false);
  });
  it("remove campos de saúde adicionados ao responsável", () => {
    const result = ApplicationSchema.parse({
      ...adultApplication,
      student: { ...adultApplication.student, birthDate: "2015-01-01" },
      relationship: "Pai",
      guardian: { ...adultApplication.student, cpf: "11144477735", allergies: "Não" },
    });
    expect(result.guardian).not.toHaveProperty("allergies");
  });
});
