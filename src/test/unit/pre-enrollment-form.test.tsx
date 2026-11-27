import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EnrollmentForm } from "@/components/enrollment/enrollment-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/app-dialog", () => ({ AppDialog: () => null }));
vi.mock("@/components/gw/logo", () => ({ Logo: () => <span>Get Wise</span> }));
const catalog = [
  {
    id: "marechal",
    name: "Get Wise Marechal",
    city: "Marechal",
    state: "PR",
    consultants: ["Secretaria", "Outro"],
    courses: [{ course: { id: "a1", title: "English A1", level: "A1" } }],
  },
  {
    id: "other",
    name: "Outra unidade",
    city: "Outra cidade",
    state: "PR",
    consultants: ["Secretaria"],
    courses: [{ course: { id: "a2", title: "English A2", level: "A2" } }],
  },
];
beforeEach(() => {
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      Response.json(
        String(url).includes("enrollment-location")
          ? {
              residence: { zipCode: "85960002", city: "Marechal", state: "PR", municipalityCode: "4114609" },
              localUnitIds: ["marechal", "other"],
            }
          : catalog
      )
    )
  );
});
async function lookup() {
  await waitFor(() => expect(screen.queryByText("Carregando unidades e cursos…")).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/CEP residencial/), { target: { value: "85960002" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
  await screen.findByRole("radio", { name: /Get Wise Marechal/ });
}
describe("formulário de pré-matrícula", () => {
  it("mostra erro e foca primeiro campo sem perder o nome", async () => {
    render(<EnrollmentForm />);
    await waitFor(() => expect(screen.queryByText("Carregando unidades e cursos…")).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Nome completo do aluno/), { target: { value: "Nome preservado" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(await screen.findByText("Consulte o CEP residencial do aluno antes de continuar.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome completo do aluno/)).toHaveValue("Nome preservado");
    await waitFor(() => expect(screen.getByLabelText(/CEP residencial/)).toHaveFocus());
  });
  it("menor tem responsável, saúde somente do aluno e cursos filtrados", async () => {
    render(<EnrollmentForm />);
    await lookup();
    fireEvent.click(screen.getByRole("radio", { name: /Get Wise Marechal/ }));
    fireEvent.change(screen.getByLabelText(/Nome completo do aluno/), { target: { value: "Aluno Teste" } });
    fireEvent.change(screen.getByLabelText(/Data de nascimento do aluno/), { target: { value: "2015-04-03" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(await screen.findByText("Dados do responsável")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/O aluno tem alguma alergia/)).toHaveLength(1);
    expect(screen.getByRole("option", { name: "English A1" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "English A2" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Curso/), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("radio", { name: /Outra unidade/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByLabelText(/^Curso/)).toHaveValue("");
    expect(screen.getByRole("option", { name: "English A2" })).toBeInTheDocument();
  });
  it("explica catálogo indisponível e oferece nova tentativa", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Falha de conexão"));
    render(<EnrollmentForm />);
    expect(await screen.findByText("Falha de conexão")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await lookup();
    expect(screen.getByRole("radio", { name: /Get Wise Marechal/ })).toBeInTheDocument();
  });
});
