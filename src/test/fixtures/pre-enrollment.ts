import { emptyApplication, type ApplicationData } from "@/lib/pre-enrollment/schema";
export const adultApplication: ApplicationData = {
  ...emptyApplication,
  schoolUnitId: "gw-marechal",
  courseId: "course-a1",
  consultant: "Secretaria",
  source: "Indicação",
  favorite: "Acolhimento",
  student: {
    name: "Aluno Teste",
    cpf: "52998224725",
    birthDate: "2000-01-01",
    gender: "Prefiro não informar",
    maritalStatus: "Solteiro(a)",
    profession: "Estudante",
    workplace: "Escola de teste",
    phone: "45999999999",
    email: "aluno@example.test",
    zipCode: "85960000",
    address: "Rua de teste",
    number: "1",
    neighborhood: "Centro",
  },
};
