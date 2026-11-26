// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
vi.unmock("@/lib/prisma");
vi.mock("@/lib/email", () => ({ sendVerificationEmail: vi.fn().mockResolvedValue(undefined) }));
import { prisma } from "@/lib/prisma";
import { requestPlacement, decidePlacement, assertPlacement } from "@/lib/pre-enrollment/placement";
import { lookupResidence } from "@/lib/pre-enrollment/location";
import { adultApplication } from "@/test/fixtures/pre-enrollment";
import { PUT as correct, GET as detail } from "@/app/api/pre-enrollments/[id]/route";
import { POST as decide } from "@/app/api/pre-enrollments/[id]/placement/route";
import { PATCH as editUser } from "@/app/api/users/[id]/route";
import { reviewApplication } from "@/lib/pre-enrollment/service";
import { POST as enroll } from "@/app/api/enrollments/route";
const enabled = process.env.RUN_CEP_DATABASE_TESTS === "1";
const run = randomUUID();
const ids = {
  director: `director-${run}`,
  secretary: `secretary-${run}`,
  owner: `owner-${run}`,
  restricted: `restricted-${run}`,
  course: `course-${run}`,
  marechal: `marechal-${run}`,
  marechal2: `marechal2-${run}`,
  toledo: `toledo-${run}`,
  plan: `plan-${run}`,
};
let request: { id: string; protocol: string; status: string };
let familyId = "";
let studentId = "";
const email = `family-${run}@example.invalid`;
const input = {
  student: { name: "Aluno Fictício", cpf: "52998224725", birthDate: "2015-01-01", zipCode: "85960002" },
  schoolUnitId: ids.toledo,
  reason: "Precisa estudar próximo do trabalho do responsável.",
  contact: { name: "Responsável Fictício", email },
};
const login = (id: string, role = "ADMIN", profileSections: string[] | null = ["pre-enrollments", "enrollments"]) =>
  vi
    .mocked(getServerSession)
    .mockResolvedValue({ user: { id, role, email, profileSections, authMethod: "password" } } as never);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const http = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/api/test", { method, body: JSON.stringify(body) });
describe.skipIf(!enabled)("CEP, autorização e matrícula em PostgreSQL exclusivo", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/getwise_cep_test")
      throw new Error("Banco exclusivo obrigatório");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const cep = /\/ws\/(\d{8})/.exec(url)?.[1];
        if (!cep || cep === "00000000") return Response.json({ erro: true });
        return Response.json({
          cep,
          localidade: cep === "85905010" ? "Toledo" : "Marechal Cândido Rondon",
          uf: "PR",
          ibge: cep === "85905010" ? "4127700" : "4114609",
          logradouro: "Rua fictícia",
          bairro: "Centro",
        });
      })
    );
    const restricted = await prisma.accessProfile.create({
      data: { id: ids.restricted, name: ids.restricted, sections: ["courses"] },
    });
    for (const key of ["director", "secretary", "owner", "restricted"] as const)
      await prisma.user.create({
        data: {
          id: ids[key],
          name: key,
          email: `${key}-${run}@example.invalid`,
          role: "ADMIN",
          isSchoolDirector: key === "director" || key === "restricted",
          profileId: key === "restricted" ? restricted.id : null,
        },
      });
    await prisma.course.create({ data: { id: ids.course, title: "Curso fictício", level: "A1" } });
    for (const key of ["marechal", "marechal2", "toledo"] as const)
      await prisma.schoolUnit.create({
        data: {
          id: ids[key],
          code: ids[key],
          name: key,
          legalName: key,
          cnpj: "",
          zipCode: "",
          address: "",
          number: "",
          neighborhood: "",
          city: key === "toledo" ? "Toledo" : "Marechal Cândido Rondon",
          state: "PR",
          phone: "",
          email: "fixture@example.invalid",
          courses: { create: { courseId: ids.course } },
        },
      });
    await prisma.plan.create({ data: { id: ids.plan, name: "Plano fictício", price: 10000, lessonsPerMonth: 4 } });
  });
  it("permite mesma cidade e bloqueia ambos os sentidos da exceção sem autorização", async () => {
    const marechal = await lookupResidence("85960002"),
      toledo = await lookupResidence("85905010");
    for (const schoolUnitId of [ids.marechal, ids.marechal2])
      await expect(assertPlacement(prisma, { ...adultApplication, schoolUnitId }, marechal)).resolves.toBeUndefined();
    await expect(
      assertPlacement(prisma, { ...adultApplication, schoolUnitId: ids.toledo }, marechal)
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      assertPlacement(prisma, { ...adultApplication, schoolUnitId: ids.marechal }, toledo)
    ).rejects.toMatchObject({ status: 409 });
  });
  it("cria pedido pendente vinculado à família sem aluno, curso ou matrícula", async () => {
    request = await requestPlacement(input, { password: "FixtureOnly!123", requestId: randomUUID() });
    const entry = await prisma.preEnrollment.findUniqueOrThrow({ where: { id: request.id } });
    familyId = entry.applicantId;
    expect(entry).toMatchObject({
      status: "PLACEMENT_PENDING",
      studentId: null,
      courseId: null,
      geographyRequired: true,
    });
    expect(await prisma.enrollment.count({ where: { preEnrollmentId: entry.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: familyId } })).role).toBe("APPLICANT");
    login(ids.owner);
    expect(
      (await detail(new NextRequest(`http://localhost/api/pre-enrollments/${entry.id}`), ctx(entry.id))).status
    ).toBe(404);
  });
  it("nega secretaria, dono genérico, professor e diretor restrito; exige justificativa", async () => {
    for (const [id, role, sections] of [
      [ids.secretary, "ADMIN", ["pre-enrollments"]],
      [ids.owner, "ADMIN", null],
      [ids.director, "TEACHER", null],
      [ids.restricted, "ADMIN", ["pre-enrollments"]],
    ] as const) {
      login(id, role, sections ? [...sections] : null);
      expect(
        (await decide(http({ version: 1, action: "APPROVED", feedback: "Teste da decisão." }), ctx(request.id))).status
      ).toBe(403);
    }
    login(ids.director);
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: ids.director, role: "ADMIN", profileSections: null, authMethod: "demo" },
    } as never);
    expect(
      (await decide(http({ version: 1, action: "APPROVED", feedback: "Teste de demonstração." }), ctx(request.id)))
        .status
    ).toBe(403);
    expect((await decide(http({ version: 1, action: "APPROVED", feedback: "" }), ctx(request.id))).status).toBe(400);
    login(ids.owner, "ADMIN", null);
    expect((await editUser(http({ isSchoolDirector: true }, "PATCH"), ctx(ids.owner))).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.owner } })).isSchoolDirector).toBe(false);
  });
  it("recusa visível, permite edição e rejeita decisão antiga após novo pedido", async () => {
    await decidePlacement(request.id, 1, "REJECTED", "Informe a necessidade de deslocamento.", ids.director);
    login(familyId, "APPLICANT", null);
    const view = await (await detail(new NextRequest("http://localhost/api/test"), ctx(request.id))).json();
    expect(view.placementRequests[0].feedback).toBe("Informe a necessidade de deslocamento.");
    await requestPlacement(
      { ...input, reason: "O responsável trabalha em Toledo durante as aulas." },
      { applicationId: request.id, applicantId: familyId, email, version: 2 }
    );
    await expect(decidePlacement(request.id, 1, "APPROVED", "Autorizado.", ids.director)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("aprova uma vez sob concorrência e limita a autorização ao aluno/CEP/unidade/pré-matrícula", async () => {
    login(ids.director);
    const decisions = await Promise.all(
      [1, 2].map(() =>
        decide(
          http({ version: 3, action: "APPROVED", feedback: "Deslocamento justificado para esta unidade." }),
          ctx(request.id)
        )
      )
    );
    expect(decisions.map((r) => r.status).sort()).toEqual([200, 409]);
    const entry = await prisma.preEnrollment.findUniqueOrThrow({ where: { id: request.id } });
    const data = entry.data as unknown as typeof adultApplication;
    const residence = await lookupResidence(input.student.zipCode);
    await expect(assertPlacement(prisma, data, residence, entry.id)).resolves.toBeUndefined();
    for (const changed of [
      { ...data, student: { ...data.student, cpf: "11144477735" } },
      { ...data, student: { ...data.student, name: "Irmão" } },
      { ...data, schoolUnitId: ids.marechal },
    ]) {
      if (changed.schoolUnitId === ids.marechal) continue; // local choice needs no exception
      await expect(assertPlacement(prisma, changed, residence, entry.id)).rejects.toMatchObject({ status: 409 });
    }
    await expect(assertPlacement(prisma, data, { ...residence, zipCode: "85960003" }, entry.id)).rejects.toMatchObject({
      status: 409,
    });
    await expect(assertPlacement(prisma, data, residence, "another-application")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("retoma formulário, mantém conta do responsável e efetiva com vínculo único", async () => {
    const data = {
      ...adultApplication,
      schoolUnitId: ids.toledo,
      courseId: ids.course,
      student: { ...adultApplication.student, ...input.student, email: "" },
      guardian: { ...adultApplication.student, cpf: "11144477735", email, name: input.contact.name },
      relationship: "Mãe",
    };
    login(familyId, "APPLICANT", null);
    expect((await correct(http({ data, version: 4 }, "PUT"), ctx(request.id))).status).toBe(200);
    await prisma.user.update({ where: { id: familyId }, data: { emailVerified: new Date() } });
    const approved = await reviewApplication(request.id, 5, "APPROVED", "", ids.secretary);
    studentId = approved.studentId!;
    expect((await prisma.user.findUniqueOrThrow({ where: { id: familyId } })).role).toBe("APPLICANT");
    login(ids.secretary, "ADMIN", ["enrollments"]);
    const body = { studentId, planId: ids.plan, startDate: "2026-12-01" };
    expect((await enroll(http(body))).status).toBe(409);
    expect((await enroll(http({ ...body, preEnrollmentId: request.id }))).status).toBe(201);
    expect((await enroll(http({ ...body, preEnrollmentId: request.id }))).status).toBe(409);
    expect(await prisma.enrollment.count({ where: { preEnrollmentId: request.id } })).toBe(1);
  });
  afterAll(async () => {
    if (familyId) {
      await prisma.payment.deleteMany({ where: { studentId } });
      await prisma.enrollment.deleteMany({ where: { studentId } });
      await prisma.preEnrollment.deleteMany({ where: { applicantId: familyId } });
      if (studentId) await prisma.user.deleteMany({ where: { id: studentId } });
      await prisma.user.deleteMany({ where: { id: familyId } });
    }
    await prisma.schoolUnit.deleteMany({ where: { id: { in: [ids.marechal, ids.marechal2, ids.toledo] } } });
    await prisma.course.deleteMany({ where: { id: ids.course } });
    await prisma.plan.deleteMany({ where: { id: ids.plan } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.director, ids.secretary, ids.owner, ids.restricted] } } });
    await prisma.accessProfile.deleteMany({ where: { id: ids.restricted } });
    await prisma.$disconnect();
    vi.unstubAllGlobals();
  });
});
