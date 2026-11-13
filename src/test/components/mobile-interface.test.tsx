import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppDialog } from "@/components/ui/app-dialog";
import { OptionRow } from "@/components/exercises/option-row";
import { CommandPalette } from "@/components/dashboard/command-palette";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Interface móvel compartilhada", () => {
  it("fecha por Escape, devolve o foco e restaura a rolagem anterior", () => {
    const close = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    document.documentElement.style.overflow = "auto";
    const view = render(
      <AppDialog open onClose={close} label="Painel">
        <button>Fechar</button>
      </AppDialog>
    );
    expect(document.documentElement.style.overflow).toBe("hidden");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
    document.documentElement.style.overflow = "";
  });

  it("alternativa comunica seleção e não envia ação quando desabilitada", () => {
    const pick = vi.fn();
    const view = render(
      <OptionRow label="to stop trying" letter="B" selected={false} disabled={false} onClick={pick} />
    );
    fireEvent.click(screen.getByRole("button", { name: "B. to stop trying" }));
    expect(pick).toHaveBeenCalledOnce();
    view.rerender(<OptionRow label="to stop trying" letter="B" selected disabled onClick={pick} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button"));
    expect(pick).toHaveBeenCalledOnce();
  });

  it("limpar a busca impede que uma resposta antiga repovoe o painel", async () => {
    let finish: (value: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const input = screen.getByRole("textbox", { name: "Buscar no sistema" });
    fireEvent.change(input, { target: { value: "curso" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    await act(async () =>
      finish(
        new Response(
          JSON.stringify({
            results: [{ type: "Curso", id: "old", title: "Resultado antigo", href: "/student/courses" }],
          })
        )
      )
    );
    expect(input).toHaveValue("");
    expect(screen.queryByText("Resultado antigo")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});
