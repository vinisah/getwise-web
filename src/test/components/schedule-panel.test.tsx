import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SchedulePanel } from "@/components/scheduling/schedule-panel";
import { AttendanceForm } from "@/app/(dashboard)/teacher/lessons/attendance-form";
import NewLessonPage from "@/app/(dashboard)/admin/lessons/new/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const lesson = {
  id: "l1",
  title: "Conversação",
  scheduledAt: "2036-02-02T22:00:00Z",
  status: "SCHEDULED",
  level: "A1",
  maxStudents: 4,
  teacher: { name: "Mentor" },
};
const booking = { id: "b1", status: "SCHEDULED", confirmation: "PENDING", absenceReason: null, lesson };
const schedule = {
  profile: { whatsappOptIn: false, level: "A1", cohort: { name: "Turma A1" } },
  bookings: [booking],
  available: [],
};
let fetchMock: ReturnType<typeof vi.fn>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Agenda — respostas e navegação", () => {
  it("oferece recuperação de uma falha inicial ao carregar", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValueOnce(json(schedule));
    render(<SchedulePanel />);
    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agenda" }));
    expect(await screen.findByText("Conversação")).toBeInTheDocument();
  });

  it("POST salvo e recarga falha: preserva a etapa de remarcação e explica que não precisa repetir", async () => {
    fetchMock
      .mockResolvedValueOnce(json(schedule))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockRejectedValueOnce(new Error("offline"));
    render(<SchedulePanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Não posso participar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Justificativa"), { target: { value: "Trabalho" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar ausência" }));
    expect(await within(dialog).findByText(/Alteração salva/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Melhor dia")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.getByRole("button", { name: "Escolher outro horário" })).toBeInTheDocument();
  });

  it("última vaga ocupada: mostra o erro no diálogo e atualiza as alternativas", async () => {
    const target = { ...lesson, id: "l2", scheduledAt: "2036-02-03T22:00:00Z", _count: { bookings: 3 } };
    const declined = {
      ...schedule,
      bookings: [{ ...booking, status: "CANCELLED", confirmation: "DECLINED" }],
      available: [target],
    };
    fetchMock
      .mockResolvedValueOnce(json(declined))
      .mockResolvedValueOnce(json({ error: "Esta aula está lotada" }, 409))
      .mockResolvedValueOnce(json({ ...declined, available: [] }));
    render(<SchedulePanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Escolher outro horário" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reservar" }));
    expect(await within(dialog).findByText("Esta aula está lotada")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument();
  });

  it("aula cancelada pela escola não oferece confirmação impossível", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ...schedule, bookings: [{ ...booking, lesson: { ...lesson, status: "CANCELLED" } }] })
    );
    render(<SchedulePanel />);
    expect(await screen.findByText(/Aula cancelada pela escola/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar participação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Não posso participar" })).not.toBeInTheDocument();
  });

  it("perfil restrito não vê botões cuja API sempre negaria", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        cohorts: [],
        teachers: [],
        students: [{ id: "s1", name: "Aluno", studentProfile: { level: "A1", cohortId: null } }],
        canAssign: false,
        canPreview: false,
      })
    );
    render(<SchedulePanel admin />);
    expect(await screen.findByText(/Aguardando alocação/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver agenda do aluno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alocar em turma do mesmo nível" })).not.toBeInTheDocument();
  });
});

describe("Agenda do professor", () => {
  it("lista renovada remove realocado, inclui novo aluno e preserva edição de quem permanece", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    const ana = { studentId: "a", name: "Ana", attendance: null };
    const bia = { studentId: "b", name: "Bia", attendance: null };
    const caio = { studentId: "c", name: "Caio", attendance: null };
    const view = render(<AttendanceForm lessonId="l1" students={[ana, bia]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Presente" })[1]);
    view.rerender(<AttendanceForm lessonId="l1" students={[bia, caio]} />);
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText("Caio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar presença" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).entries).toEqual([
      { studentId: "b", attendance: true },
      { studentId: "c", attendance: null },
    ]);
  });
});

describe("Cadastro manual de aula", () => {
  it("usa a permissão da agenda, permite definir vagas e limpa a seleção ao trocar de nível", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        teachers: [{ id: "t1", name: "Mentor" }],
        students: [
          { id: "s1", name: "Ana A1", studentProfile: { level: "A1" } },
          { id: "s2", name: "Bia A2", studentProfile: { level: "A2" } },
        ],
      })
    );
    render(<NewLessonPage />);
    expect(await screen.findByText("Ana A1")).toBeInTheDocument();
    expect(screen.queryByText("Bia A2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Capacidade da aula")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Nível"), { target: { value: "A2" } });
    expect(screen.queryByText("Ana A1")).not.toBeInTheDocument();
    expect(screen.getByText("Bia A2")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nível"), { target: { value: "A1" } });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/scheduling?admin=true");
  });
});
