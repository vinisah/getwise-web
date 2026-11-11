import { assignStudent, schedulingTransaction } from "@/lib/scheduling/service";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, zodMessage } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateStudentSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin("students");

  const parsed = CreateStudentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }

  const { name, email, password, phone, level, birthDate, cpf, address, city, state, zipCode, notes, emergencyContact } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await schedulingTransaction(async (tx) => {
  const created = await tx.user.create({
    data: {
      name,
      email,
      phone,
      password: hashedPassword,
      role: "STUDENT",
      studentProfile: {
        create: {
          level,
          birthDate: birthDate ? new Date(birthDate) : null,
          cpf,
          address,
          city,
          state,
          zipCode,
          notes,
          emergencyContact,
        },
      },
    },
    include: { studentProfile: true },
  });
  if (["A1", "A2", "A3"].includes(level)) await assignStudent(created.id, tx);
  return created;
  });

  await audit({ userId: session.user.id, action: "CREATE_STUDENT", entity: "Student", entityId: user.id });

  return NextResponse.json(user, { status: 201 });
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("students");

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      studentProfile: true,
      enrollments: { where: { status: "ACTIVE" }, include: { plan: true } },
    },
    orderBy: { name: "asc" },
    take: 1000, // cap de segurança
  });

  return NextResponse.json(students);
});
