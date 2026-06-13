import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@getwise.com.br" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@getwise.com.br",
      password: adminPassword,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  // Professor
  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const teacher = await prisma.user.upsert({
    where: { email: "professor@getwise.com.br" },
    update: {},
    create: {
      name: "Prof. Ana Silva",
      email: "professor@getwise.com.br",
      password: teacherPassword,
      role: "TEACHER",
      emailVerified: new Date(),
      teacherProfile: {
        create: {
          bio: "English teacher with 10 years of experience",
          hourlyRate: 8000, // R$ 80,00 em centavos
        },
      },
    },
  });

  // Aluno demo
  const studentPassword = await bcrypt.hash("student123", 10);
  const studentGamification = {
    xp: 4820,
    streak: 7,
    rank: "Prata",
    weeklyGoal: 3,
    skills: { listening: 78, speaking: 64, reading: 85, writing: 71 },
  };
  const student = await prisma.user.upsert({
    where: { email: "aluno@getwise.com.br" },
    update: { studentProfile: { update: studentGamification } },
    create: {
      name: "João da Silva",
      email: "aluno@getwise.com.br",
      password: studentPassword,
      role: "STUDENT",
      emailVerified: new Date(),
      studentProfile: {
        create: {
          level: "B1",
          city: "São Paulo",
          state: "SP",
          xp: 4820,
          streak: 7,
          rank: "Prata",
          weeklyGoal: 3,
          skills: { listening: 78, speaking: 64, reading: 85, writing: 71 },
        },
      },
    },
  });

  // Planos
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { id: "plan-basic" },
      update: {},
      create: {
        id: "plan-basic",
        name: "Basic",
        description: "2 aulas por semana, ideal para iniciantes",
        price: 39700, // R$ 397,00 em centavos
        lessonsPerMonth: 8,
        lessonDurationMin: 50,
        features: ["8 aulas/mês", "Material didático", "Acesso ao Tutor IA", "Exercícios online"],
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan-standard" },
      update: {},
      create: {
        id: "plan-standard",
        name: "Standard",
        description: "3 aulas por semana, o mais popular",
        price: 54700, // R$ 547,00 em centavos
        lessonsPerMonth: 12,
        lessonDurationMin: 50,
        features: ["12 aulas/mês", "Material didático", "Acesso ao Tutor IA", "Exercícios online", "Suporte WhatsApp"],
      },
    }),
    prisma.plan.upsert({
      where: { id: "plan-premium" },
      update: {},
      create: {
        id: "plan-premium",
        name: "Premium",
        description: "Aulas diárias para máxima evolução",
        price: 79700, // R$ 797,00 em centavos
        lessonsPerMonth: 20,
        lessonDurationMin: 60,
        features: ["20 aulas/mês", "Material exclusivo", "Tutor IA ilimitado", "Exercícios personalizados", "Suporte prioritário"],
      },
    }),
  ]);

  // Categorias financeiras
  const categories = [
    { name: "Mensalidade", type: "INCOME" as const, color: "#22c55e" },
    { name: "Matrícula", type: "INCOME" as const, color: "#3b82f6" },
    { name: "Material didático (venda)", type: "INCOME" as const, color: "#8b5cf6" },
    { name: "Salários", type: "EXPENSE" as const, color: "#ef4444" },
    { name: "Aluguel", type: "EXPENSE" as const, color: "#f97316" },
    { name: "Marketing", type: "EXPENSE" as const, color: "#ec4899" },
    { name: "Tecnologia", type: "EXPENSE" as const, color: "#6366f1" },
    { name: "Material didático (compra)", type: "EXPENSE" as const, color: "#84cc16" },
  ];

  for (const cat of categories) {
    await prisma.financialCategory.upsert({
      where: { id: `cat-${cat.name.toLowerCase().replace(/\s/g, "-")}` },
      update: {},
      create: { id: `cat-${cat.name.toLowerCase().replace(/\s/g, "-")}`, ...cat },
    });
  }

  // Exercícios demo
  await prisma.exercise.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "seed-ex-1",
        title: "Present Simple vs. Present Continuous",
        type: "MULTIPLE_CHOICE",
        level: "B1",
        content: {
          question: 'Choose the correct form: "She _____ to work every day."',
          options: ["walk", "walks", "is walking", "walking"],
        },
        correctAnswer: "walks",
        explanation: "We use Present Simple for habits and routines. 'She' requires the -s form: 'walks'.",
        points: 10,
      },
      {
        id: "seed-ex-2",
        title: "Vocabulary: Common Phrasal Verbs",
        type: "MULTIPLE_CHOICE",
        level: "B1",
        content: {
          question: 'What does "give up" mean?',
          options: ["to start something new", "to stop trying", "to give a gift", "to increase"],
        },
        correctAnswer: "to stop trying",
        explanation: '"Give up" means to stop doing or trying something.',
        points: 10,
      },
      {
        id: "seed-ex-3",
        title: "True or False: Grammar Rule",
        type: "TRUE_FALSE",
        level: "A1",
        content: {
          question: 'In English, we say "I am have" to describe possession.',
        },
        correctAnswer: "False",
        explanation: 'To express possession in English, we use "have": "I have a car" — not "I am have".',
        points: 5,
      },
      {
        id: "seed-ex-4",
        title: "Fill in the blank",
        type: "FILL_IN_BLANK",
        level: "A2",
        content: {
          question: 'Complete: "Yesterday, I _____ (go) to the supermarket."',
        },
        correctAnswer: "went",
        explanation: '"Go" is an irregular verb. Past simple of "go" is "went".',
        points: 10,
      },
    ],
  });

  // Matrícula demo
  const enrollment = await prisma.enrollment.upsert({
    where: { id: "enrollment-demo" },
    update: {},
    create: {
      id: "enrollment-demo",
      studentId: student.id,
      planId: "plan-standard",
      startDate: new Date("2026-01-01"),
      status: "ACTIVE",
    },
  });

  // ─── Cursos demo (CEFR) ──────────────────────────────────────────────────────
  const courseA1 = await prisma.course.upsert({
    where: { id: "course-a1" },
    update: {},
    create: {
      id: "course-a1",
      title: "English Foundations (A1)",
      description: "Comece do zero: alfabeto, saudações, presente simples e vocabulário básico.",
      level: "A1",
      order: 1,
      modules: {
        create: [
          {
            id: "mod-a1-1",
            title: "Getting Started",
            order: 1,
            units: {
              create: [
                { id: "u-a1-1", title: "The Alphabet & Sounds", order: 1, content: "Aprenda o alfabeto em inglês e a pronúncia de cada letra. Pratique soletrar seu nome.\n\nA, B, C, D... cada som importa para a comunicação clara." },
                { id: "u-a1-2", title: "Greetings & Introductions", order: 2, content: "Hello! Hi! Good morning! Aprenda a se apresentar: 'My name is...', 'Nice to meet you.'" },
                { id: "u-a1-3", title: "Numbers 1-100", order: 3, content: "Conte de 1 a 100. Pratique idade, telefone e preços." },
              ],
            },
          },
          {
            id: "mod-a1-2",
            title: "Everyday Basics",
            order: 2,
            units: {
              create: [
                { id: "u-a1-4", title: "The Verb 'To Be'", order: 1, content: "I am, you are, he/she/it is. A base de toda frase em inglês." },
                { id: "u-a1-5", title: "Days, Months & Time", order: 2, content: "Monday to Sunday, January to December. What time is it?" },
              ],
            },
          },
        ],
      },
    },
  });

  const courseA2 = await prisma.course.upsert({
    where: { id: "course-a2" },
    update: {},
    create: {
      id: "course-a2",
      title: "Elementary English (A2)",
      description: "Avance: passado simples, futuro, comparativos e conversação do dia a dia.",
      level: "A2",
      order: 2,
      modules: {
        create: [
          {
            id: "mod-a2-1",
            title: "Talking About the Past",
            order: 1,
            units: {
              create: [
                { id: "u-a2-1", title: "Past Simple — Regular Verbs", order: 1, content: "I worked, you played, she watched. Adicione -ed para falar do passado." },
                { id: "u-a2-2", title: "Past Simple — Irregular Verbs", order: 2, content: "go→went, eat→ate, see→saw. Memorize os verbos irregulares mais comuns." },
              ],
            },
          },
        ],
      },
    },
  });

  // Prereq: A2 requer A1 concluído
  await prisma.coursePrerequisite.upsert({
    where: { courseId_requiredCourseId: { courseId: "course-a2", requiredCourseId: "course-a1" } },
    update: {},
    create: { courseId: "course-a2", requiredCourseId: "course-a1" },
  });

  void courseA1;
  void courseA2;

  // ─── Unit demo enriquecida (vídeo + exercícios) ──────────────────────────────
  await prisma.unit.update({
    where: { id: "u-a1-1" },
    data: {
      type: "MIXED",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      videoDurationSeconds: 10,
      durationMinutes: 5,
    },
  });

  await prisma.exercise.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "ex-a1-1-mc",
        unitId: "u-a1-1",
        title: "Soletração",
        type: "MULTIPLE_CHOICE",
        level: "A1",
        order: 1,
        isRequired: true,
        points: 10,
        content: { question: "How do you spell the first letter of the alphabet?", options: ["Ay", "Bee", "Cee", "Dee"] },
        correctAnswer: "Ay",
        explanation: "A é pronunciado 'Ay'.",
      },
      {
        id: "ex-a1-1-fill",
        unitId: "u-a1-1",
        title: "Saudação",
        type: "FILL_IN_BLANK",
        level: "A1",
        order: 2,
        isRequired: true,
        points: 10,
        content: { question: "Complete: '_____ morning!' (de manhã)" },
        correctAnswer: ["good", "Good"],
        explanation: "'Good morning' é a saudação matinal.",
      },
      {
        id: "ex-a1-1-trans",
        unitId: "u-a1-1",
        title: "Tradução",
        type: "TRANSLATION",
        level: "A1",
        order: 3,
        isRequired: false,
        points: 10,
        content: { question: "Traduza para o inglês: 'Prazer em conhecê-lo'" },
        correctAnswer: ["nice to meet you", "pleased to meet you"],
        explanation: "Similaridade textual ≥ 80% aceita.",
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log("─────────────────────────────────");
  console.log("Admin:     admin@getwise.com.br / admin123");
  console.log("Professor: professor@getwise.com.br / teacher123");
  console.log("Aluno:     aluno@getwise.com.br / student123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
