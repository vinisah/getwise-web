import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/getwise_cep_test")
  throw Error("Somente banco exclusivo de revisão CEP");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
try {
  const password = await bcrypt.hash("RevisaoLocal!2026", 12);
  const profile = await db.accessProfile.upsert({
    where: { name: "Revisão CEP · secretaria" },
    update: {},
    create: {
      name: "Revisão CEP · secretaria",
      sections: ["pre-enrollments", "school-units", "enrollments", "students"],
    },
  });
  for (const role of ["operador", "direcao", "secretaria"]) {
    await db.user.upsert({
      where: { email: `${role}.cep@example.invalid` },
      update: { password, isActive: true },
      create: {
        name: `Revisão CEP · ${role}`,
        email: `${role}.cep@example.invalid`,
        password,
        role: "ADMIN",
        profileId: role === "operador" ? null : profile.id,
        emailVerified: new Date(),
      },
    });
  }
  const course = await db.course.upsert({
    where: { id: "cep-review-a1" },
    update: {},
    create: { id: "cep-review-a1", title: "English Foundations A1 · revisão", level: "A1" },
  });
  for (const [id, name, city] of [
    ["cep-review-marechal", "Get Wise Marechal", "Marechal Cândido Rondon"],
    ["cep-review-marechal2", "Get Wise Marechal · unidade de teste", "Marechal Cândido Rondon"],
    ["cep-review-toledo", "Get Wise Toledo · demonstração", "Toledo"],
  ]) {
    await db.schoolUnit.upsert({
      where: { id },
      update: {},
      create: {
        id,
        code: id,
        name,
        city,
        state: "PR",
        legalName: "Unidade fictícia de revisão",
        cnpj: "",
        zipCode: "",
        address: "Endereço de avaliação",
        number: "1",
        neighborhood: "Centro",
        phone: "",
        email: "escola@example.invalid",
        courses: { create: { courseId: course.id } },
      },
    });
  }
  console.log(
    "Contas e unidades fictícias disponíveis. Senha local: RevisaoLocal!2026. Direção precisa da designação operacional explícita."
  );
} finally {
  await db.$disconnect();
}
