import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TutorMessage } from "@/components/tutor/tutor-message";

let resizeTable: () => void;
const disconnectTable = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resizeTable = callback; }
    observe() {}
    disconnect = disconnectTable;
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Respostas formatadas da Wise", () => {
  it("renders emphasis, lists and vocabulary tables as semantic HTML", () => {
    const { container } = render(<TutorMessage content={"**Confiança** e *calma*.\n\n- Um passo\n- Outro passo\n\n| Palavra | Tradução |\n| --- | --- |\n| Morning | Manhã |"} />);
    expect(container.querySelector("strong")).toHaveTextContent("Confiança");
    expect(container.querySelector("em")).toHaveTextContent("calma");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByRole("table")).toHaveTextContent("Morning");
    expect(screen.getByRole("region", { name: "Tabela da resposta" })).not.toHaveAttribute("tabindex");
    expect(container.textContent).not.toContain("**");
  });

  it("keeps an overflowing table focusable and mounted when the reveal finishes", () => {
    const { unmount } = render(<TutorMessage animate content={"| Palavra | Tradução |\n| --- | --- |\n| Morning | Manhã |"} />);
    const region = screen.getByRole("region", { name: "Tabela da resposta" });
    Object.defineProperties(region, { clientWidth: { value: 200, configurable: true }, scrollWidth: { value: 400 } });
    act(() => resizeTable());
    expect(region).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar tudo agora" }));
    expect(screen.getByRole("region", { name: "Tabela da resposta" })).toBe(region);
    expect(region).toHaveAttribute("tabindex", "0");
    Object.defineProperty(region, "clientWidth", { value: 500 });
    act(() => resizeTable());
    expect(region).not.toHaveAttribute("tabindex");
    unmount();
    expect(disconnectTable).toHaveBeenCalled();
  });

  it("never executes HTML, loads remote images or creates unsafe links", () => {
    const { container } = render(<TutorMessage content={'<script>alert(1)</script>\n\n![pixel](https://example.com/pixel)\n\n[perigoso](javascript:alert%281%29)\n\n[seguro](https://example.com)'} />);
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("lets the reader skip the reveal without losing formatting or replaying it", () => {
    const { container, rerender } = render(<TutorMessage animate content="**Bem-vindo**, vamos aprender." />);
    const firstWord = container.querySelector(".tutor-word")!;
    expect(firstWord).toHaveAttribute("style");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar tudo agora" }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<TutorMessage animate content="**Bem-vindo**, vamos aprender." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("Bem-vindo");
  });

  it("completes even long replies within ten seconds and clears timers on unmount", () => {
    // 200 words exceed the nine-second reveal cap without a huge test DOM.
    const { unmount } = render(<TutorMessage animate content={"palavra ".repeat(200)} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows the full response immediately when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<TutorMessage animate content="**Sem animação**, com o mesmo cuidado." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});
