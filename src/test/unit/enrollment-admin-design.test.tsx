import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SchoolUnitEditor, SchoolUnitList } from "@/components/enrollment/school-units";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/ui/app-dialog", () => ({ AppDialog: () => null }));
const unit = {
  id: "test",
  version: 3,
  code: "01",
  name: "Unidade teste",
  legalName: "Escola teste",
  cnpj: "",
  zipCode: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "Curitiba",
  state: "PR",
  phone: "",
  mobile: "",
  email: "escola@example.invalid",
  classification: "",
  notes: "Observação preservada",
  logoUrl: "",
  photos: [],
  partners: [],
  consultants: ["Secretaria"],
  courseIds: [],
  courses: [],
  isActive: true,
  enrollmentOpen: true,
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
});
describe("acabamento administrativo sem regressão de formulário", () => {
  it("combina busca e situação e permite limpar os filtros", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [unit, { ...unit, id: "closed", name: "Unidade fechada", isActive: false }],
    } as Response);
    render(<SchoolUnitList />);
    await screen.findByText("Unidade fechada");
    fireEvent.change(screen.getByLabelText(/Situação/), { target: { value: "inactive" } });
    expect(screen.queryByText("Unidade teste")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Buscar unidade/), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhuma unidade encontrada.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByText("Unidade teste")).toBeInTheDocument();
    expect(screen.getByText("Unidade fechada")).toBeInTheDocument();
  });
  it("abre a seção fechada e foca um campo inválido sem perder os demais dados", async () => {
    render(<SchoolUnitEditor initial={{ ...unit, logoUrl: "http://invalido.example" }} />);
    const field = screen.getByLabelText(/Endereço do logo/);
    expect(field.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Salvar unidade" }));
    await waitFor(() => expect(field).toHaveFocus());
    expect(field.closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText(/Nome fantasia/)).toHaveValue("Unidade teste");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("mantém valores das seções fechadas e a versão no envio; falha permite nova tentativa", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      init?.method === "PUT"
        ? ({ ok: false, json: async () => ({ error: "Falha ao salvar" }) } as Response)
        : ({ ok: true, json: async () => [] } as Response)
    );
    render(<SchoolUnitEditor initial={unit} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar unidade" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao salvar");
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      version: 3,
      notes: "Observação preservada",
      isActive: true,
      enrollmentOpen: true,
    });
    expect(screen.getByRole("button", { name: "Salvar unidade" })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});
