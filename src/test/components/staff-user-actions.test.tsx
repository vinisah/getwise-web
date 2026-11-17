import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserActions } from "@/app/(dashboard)/admin/users/user-actions";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const props = {
  userId: "staff",
  role: "ADMIN",
  isActive: true,
  isSelf: false,
  profileId: null,
  profiles: [{ id: "secretaria", name: "Secretaria" }],
};
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Ações da equipe interna", () => {
  it("oferece só papéis internos e mantém perfis de funcionários", () => {
    render(<UserActions {...props} />);
    const roles = screen.getByRole("combobox", { name: "Papel na equipe" });
    expect([...roles.querySelectorAll("option")].map((o) => o.value)).toEqual(["ADMIN", "TEACHER"]);
    expect(screen.getByRole("option", { name: "Secretaria" })).toBeInTheDocument();
  });

  it("falha de rede mantém papel salvo e libera uma nova tentativa", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<UserActions {...props} />);
    const roles = screen.getByRole("combobox", { name: "Papel na equipe" });
    fireEvent.change(roles, { target: { value: "TEACHER" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    expect(roles).toHaveValue("ADMIN");
    expect(roles).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("senha fica oculta; erro de validação foca campo e não envia requisição", () => {
    render(<UserActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Definir senha temporária" }));
    const field = screen.getByLabelText("Senha temporária (mín. 6)");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(field).toHaveAttribute("type", "text");
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Definir" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Mínimo 6 caracteres");
    expect(field).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bloqueia comandos durante gravação e atualiza a lista após sucesso", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<UserActions {...props} />);
    const roles = screen.getByRole("combobox", { name: "Papel na equipe" });
    fireEvent.change(roles, { target: { value: "TEACHER" } });
    expect(roles).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desativar acesso" })).toBeDisabled();
    finish(new Response("{}", { status: 200 }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
