import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EnrollmentForm } from "@/components/enrollment/enrollment-form";
import { ApplicationDetail } from "@/components/enrollment/application-detail";
import { adultApplication } from "@/test/fixtures/pre-enrollment";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/app-dialog", () => ({ AppDialog: () => null }));
vi.mock("@/components/gw/logo", () => ({ Logo: () => <span>Get Wise</span> }));
const catalog = [
  {
    id: "marechal",
    name: "Get Wise Marechal",
    city: "Marechal Cândido Rondon",
    state: "PR",
    consultants: ["Secretaria"],
    courses: [],
  },
  { id: "toledo", name: "Get Wise Toledo", city: "Toledo", state: "PR", consultants: ["Secretaria"], courses: [] },
];
const location = {
  residence: {
    zipCode: "85960002",
    city: "Marechal Cândido Rondon",
    state: "PR",
    municipalityCode: "4114609",
    address: "Rua exemplo",
    neighborhood: "Centro",
  },
  localUnitIds: ["marechal"],
};
function change(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
async function ready() {
  await waitFor(() => expect(screen.queryByText("Carregando unidades e cursos…")).not.toBeInTheDocument());
}
async function lookup() {
  await ready();
  change(/CEP residencial/, "85960002");
  fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
  await screen.findByRole("radio", { name: /Marechal/ });
}
beforeEach(() => {
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => Response.json(String(url).includes("enrollment-location") ? location : catalog))
  );
});
describe("experiência de CEP aprovada", () => {
  it("orienta a família quando só há unidades abertas na própria cidade", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json([catalog[0]]));
    render(<EnrollmentForm />);
    await lookup();
    fireEvent.click(screen.getByRole("button", { name: "Preciso estudar em outra cidade" }));
    expect(screen.getByText(/Nenhuma unidade de outra cidade está aberta/)).toBeVisible();
    expect(screen.queryByLabelText(/Por que precisa estudar/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar análise da direção" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar às unidades da minha cidade" }));
    expect(screen.getByRole("radio", { name: /Marechal/ })).toBeVisible();
  });

  it.each([
    ["REJECTED", /A direção recusou o pedido/],
    ["SUPERSEDED", /Este pedido perdeu a validade/],
  ] as const)("mantém o resultado histórico %s ao seguir pela unidade local", async (status, message) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        id: "ficha",
        protocol: "GW-TESTE",
        version: 4,
        status: "PENDING",
        feedback: "",
        data: adultApplication,
        schoolUnit: catalog[0],
        course: { title: "Inglês" },
        applicant: { emailVerified: null },
        placementRequests: [
          {
            status,
            reason: "Transporte escolar",
            feedback: "",
            snapshot: { student: adultApplication.student, residence: location.residence, unit: catalog[1] },
          },
        ],
      })
    );
    render(<ApplicationDetail id="ficha" />);
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText(/A direção autorizou esta unidade/)).not.toBeInTheDocument();
  });

  it("envia pedido de outra cidade pelo responsável sem concluir a pré-matrícula", async () => {
    render(<EnrollmentForm />);
    await lookup();
    expect(screen.queryByRole("radio", { name: /Toledo/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preciso estudar em outra cidade" }));
    fireEvent.click(screen.getByRole("radio", { name: /Toledo/ }));
    change(/Nome completo do aluno/, "Aluno Teste");
    change(/Data de nascimento/, "2015-04-03");
    change(/CPF do aluno/, "52998224725");
    change(/Por que precisa/, "Preciso de uma unidade perto do trabalho.");
    change(/Nome completo do responsável/, "Responsável Teste");
    change(/E-mail de acesso/, "responsavel@example.invalid");
    change(/^Senha/, "FixtureOnly!123");
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ id: "draft", protocol: "GW-TEST", status: "PLACEMENT_PENDING" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Solicitar análise da direção" }));
    expect(await screen.findByRole("heading", { name: "Pedido enviado à direção" })).toBeInTheDocument();
    expect(screen.getByText(/nenhuma vaga foi reservada/)).toBeInTheDocument();
    expect(screen.queryByText("Recebemos sua pré-matrícula")).not.toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("enrollment-placement"));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      data: {
        student: { zipCode: "85960002", cpf: "52998224725" },
        schoolUnitId: "toledo",
        contact: { email: "responsavel@example.invalid" },
      },
    });
  });
  it("preserva CEP na indisponibilidade e permite nova tentativa", async () => {
    render(<EnrollmentForm />);
    await ready();
    change(/CEP residencial/, "85960002");
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: "Consulta indisponível. Tente novamente." }, { status: 503 })
    );
    fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
    expect(await screen.findByText("Consulta indisponível. Tente novamente.")).toBeInTheDocument();
    expect(screen.getByLabelText(/CEP residencial/)).toHaveValue("85960002");
    fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
    expect(await screen.findByRole("radio", { name: /Marechal/ })).toBeInTheDocument();
  });
  it("ignora consulta antiga quando o CEP muda", async () => {
    render(<EnrollmentForm />);
    await ready();
    let resolve!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    change(/CEP residencial/, "85960002");
    fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
    change(/CEP residencial/, "85905010");
    resolve(Response.json(location));
    await waitFor(() => expect(screen.getByRole("button", { name: "Consultar CEP" })).toBeEnabled());
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it("município sem unidade ainda permite solicitar outra cidade", async () => {
    render(<EnrollmentForm />);
    await ready();
    change(/CEP residencial/, "85960002");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...location, localUnitIds: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Consultar CEP" }));
    expect(await screen.findByText(/Não há unidade aberta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preciso estudar em outra cidade" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
