import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { SchoolData } from "@/components/enrollment/school-units";
export async function getSchoolUnit(id: string) {
  await requireAdmin("school-units");
  const u = await prisma.schoolUnit.findUnique({
    where: { id },
    include: { courses: { include: { course: { select: { id: true, title: true } } } } },
  });
  if (!u) notFound();
  return { ...u, partners: u.partners as SchoolData["partners"], courseIds: u.courses.map((c) => c.courseId) };
}
