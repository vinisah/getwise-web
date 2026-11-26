import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signIn, signOut } from "next-auth/react";
import LoginPage from "@/app/(auth)/login/page";
import { ApplicationList } from "@/components/enrollment/application-list";
import { isPreEnrollmentAccess, loginDestination, PRE_ENROLLMENT_LOGIN } from "@/lib/pre-enrollment/access";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), params: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams(nav.params),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/components/gw/logo", () => ({ Logo: () => <span>Get Wise</span> }));

beforeEach(() => {
  nav.params = "";
  vi.clearAllMocks();
  vi.mocked(signIn).mockReset().mockResolvedValue({ ok: true, error: null, status: 200, url: "/" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillLogin() {
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "Responsavel@EXAMPLE.INVALID" } });
  fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "Senha-de-teste" } });
}

describe("acesso ao acompanhamento", () => {
  it("oferece no login entradas distintas para acompanhar e fazer matrícula", async () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Acompanhar pré-matrícula" })).toHaveAttribute(
      "href",
      PRE_ENROLLMENT_LOGIN
    );
    expect(screen.getByRole("link", { name: "Fazer matrícula online" })).toHaveAttribute("href", "/register");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("autentica o e-mail do cadastro e abre a situação sem passar pelo formulário", async () => {
    nav.params = "mode=pre-enrollment&callbackUrl=/register";
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Acompanhe sua pré-matrícula" })).toBeInTheDocument();
    expect(screen.getByText(/use o e-mail do responsável/)).toBeInTheDocument();
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Consultar situação" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/pre-enrollments"));
    expect(signIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ email: "responsavel@example.invalid", password: "Senha-de-teste", redirect: false })
    );
    expect(nav.refresh).toHaveBeenCalledOnce();
  });

  it("preserva acesso direto a uma solicitação ao retornar do login", async () => {
    nav.params = "callbackUrl=%2Fpre-enrollments%2Fentry-1";
    render(<LoginPage />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Consultar situação" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/pre-enrollments/entry-1"));
  });

  it("preserva o destino do portal para quem entra normalmente", async () => {
    nav.params = "callbackUrl=/teacher/schedule";
    render(<LoginPage />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no portal" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/teacher/schedule"));
  });

  it("valida campos vazios e e-mail inválido com foco antes da autenticação", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar no portal" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe seu e-mail e senha.");
    expect(screen.getByLabelText(/^E-mail/)).toHaveFocus();
    fillLogin();
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "invalido" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no portal" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it.each([undefined, { ok: false, status: 401, error: "CredentialsSignin", url: null }])(
    "mantém dados e permite tentar novamente quando o login não é confirmado: %j",
    async (result) => {
      vi.mocked(signIn).mockResolvedValueOnce(result);
      nav.params = "mode=pre-enrollment";
      render(<LoginPage />);
      fillLogin();
      fireEvent.click(screen.getByRole("button", { name: "Consultar situação" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Confira seu e-mail e senha");
      expect(nav.replace).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^E-mail/)).toHaveValue("Responsavel@EXAMPLE.INVALID");
      fireEvent.click(screen.getByRole("button", { name: "Consultar situação" }));
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/pre-enrollments"));
    }
  );

  it("bloqueia envio duplo e recupera de falha de conexão", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(signIn).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    );
    render(<LoginPage />);
    fillLogin();
    const form = screen.getByRole("button", { name: "Entrar no portal" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signIn).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    expect(screen.getByRole("button", { name: "Entrar no portal" })).toBeEnabled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it.each([
    "https://external.example",
    "//external.example",
    "/\\external.example",
    "/register",
    "/register?return=1",
    "/admin/../register",
    "/pre-enrollments-fake",
    "/\n/external.example",
  ])("não redireciona o acompanhamento para %s", (callback) => {
    expect(loginDestination(callback, true)).toBe("/pre-enrollments");
    expect(loginDestination(callback, false)).toBe("/");
    expect(isPreEnrollmentAccess(null, callback)).toBe(false);
  });
});

describe("situação das pré-matrículas da conta", () => {
  function respond(items: object[] = []) {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items, total: items.length, page: 1, accountEmail: "responsavel@example.invalid" }),
    } as Response);
  }
  it("identifica a conta, orienta quem não encontra a ficha e permite trocar o e-mail", async () => {
    respond();
    render(<ApplicationList />);
    expect(await screen.findByText(/Conta de acompanhamento: responsavel@example.invalid/)).toBeInTheDocument();
    expect(screen.getByText("Nenhuma pré-matrícula vinculada a esta conta")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Entrar com outro e-mail" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ callbackUrl: PRE_ENROLLMENT_LOGIN }));
  });
  it("diferencia filtro sem resultado de uma conta sem solicitação", async () => {
    nav.params = "status=APPROVED";
    respond();
    render(<ApplicationList />);
    expect(await screen.findByText("Nenhuma pré-matrícula encontrada com estes filtros.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma pré-matrícula vinculada a esta conta")).not.toBeInTheDocument();
  });
  it("mostra situação, protocolo e detalhe de cada aluno da família", async () => {
    respond(
      [1, 2].map((n) => ({
        id: `entry-${n}`,
        studentName: `Aluno ${n}`,
        protocol: `GW-${n}`,
        status: "PENDING",
        createdAt: "2026-11-26T15:00:00Z",
        schoolUnit: { name: "Get Wise Marechal" },
        course: { title: "English A1" },
      }))
    );
    render(<ApplicationList />);
    expect(await screen.findByRole("link", { name: /Aluno 1/ })).toHaveAttribute("href", "/pre-enrollments/entry-1");
    expect(screen.getByRole("link", { name: /Aluno 2/ })).toHaveAttribute("href", "/pre-enrollments/entry-2");
    expect(nav.replace).not.toHaveBeenCalled();
  });
  it("apresenta erro de consulta com nova tentativa sem encaminhar ao cadastro", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Falha na consulta"));
    render(<ApplicationList />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha na consulta");
    respond();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma pré-matrícula vinculada a esta conta")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
