import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TutorPage from "@/app/(dashboard)/student/tutor/page";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("presents the tutor gently and formats a successful answer", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sessionId: "chat", reply: "**Good morning** significa bom dia." }) }));
  const { container } = render(<TutorPage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Vamos aprender no seu ritmo?");
  fireEvent.click(screen.getByRole("button", { name: /Conversar sem pressa/ }));
  await waitFor(() => expect(container.querySelector("strong")).toHaveTextContent("Good morning"));
  expect(screen.getByLabelText("Sua mensagem para a Wise")).toBeEnabled();
});

it("does not append a late reply to a new conversation", async () => {
  let resolveResponse!: (value: unknown) => void;
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, options) => { signal = options.signal; return new Promise((resolve) => { resolveResponse = resolve; }); }));
  const { container } = render(<TutorPage />);
  fireEvent.click(screen.getByRole("button", { name: /Conversar sem pressa/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nova conversa/ }));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolveResponse({ ok: true, json: async () => ({ reply: "Resposta antiga" }) }));
  expect(container).not.toHaveTextContent("Resposta antiga");
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
});

it("shows a service error instead of presenting it as a successful reply", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Tutor indisponível no momento." }) }));
  const { container } = render(<TutorPage />);
  fireEvent.click(screen.getByRole("button", { name: /Conversar sem pressa/ }));
  await waitFor(() => expect(container).toHaveTextContent("Tutor indisponível no momento."));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
