import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreferencesEditor } from "@/components/preferences/preferences-editor";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";
import { TutorMessage } from "@/components/tutor/tutor-message";
import { DEFAULT_PREFS } from "@/lib/theme";

const version = "a".repeat(64);
function response(body: unknown, ok = true) {
  return { ok, json: async () => body };
}
function editor() {
  return render(
    <PreferencesProvider initialPrefs={DEFAULT_PREFS}>
      <PreferencesEditor accountName="Ana Maria" />
    </PreferencesProvider>
  );
}
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
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("loads, previews and saves the authenticated preferences; cookie excludes nickname", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ prefs: DEFAULT_PREFS, version }))
    .mockImplementationOnce(async (_url, options) =>
      response({ prefs: JSON.parse(options.body), version: "b".repeat(64) })
    );
  vi.stubGlobal("fetch", fetcher);
  editor();
  await waitFor(() => expect(screen.getByLabelText("Apelido")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Lia" } });
  fireEvent.click(screen.getByRole("radio", { name: "Azul Royal" }));
  expect(screen.getByText("Olá, Lia!")).toBeInTheDocument();
  expect(document.documentElement.style.getPropertyValue("--brand")).toBe("#16204E");
  fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
  await screen.findByText("Preferências salvas na sua conta.");
  expect(document.documentElement.style.getPropertyValue("--brand")).toBe("#2440CC");
  expect(decodeURIComponent(document.cookie)).not.toContain("Lia");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ nickname: "Lia", version });
});
it("keeps edits after a failed save and permits retry without duplicate requests", async () => {
  let finish!: (value: unknown) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ prefs: DEFAULT_PREFS, version }))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(response({ prefs: { ...DEFAULT_PREFS, nickname: "Lia" }, version }));
  vi.stubGlobal("fetch", fetcher);
  editor();
  await waitFor(() => expect(screen.getByLabelText("Apelido")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Lia" } });
  const save = screen.getByRole("button", { name: "Salvar preferências" });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(save).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => finish(response({ error: "Conexão indisponível" }, false)));
  expect(screen.getByRole("alert")).toHaveTextContent("Conexão indisponível");
  expect(screen.getByLabelText("Apelido")).toHaveValue("Lia");
  fireEvent.click(save);
  await screen.findByText("Preferências salvas na sua conta.");
});
it("validates the nickname and focuses the field; discard restores saved choices", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ prefs: DEFAULT_PREFS, version }));
  vi.stubGlobal("fetch", fetcher);
  editor();
  await waitFor(() => expect(screen.getByLabelText("Apelido")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "<Ana>" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
  expect(screen.getByLabelText("Apelido")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Apelido")).toHaveFocus();
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(screen.getByLabelText("Apelido")).toHaveValue("");
});
it("offers recovery after a loading error", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("Sem conexão"))
      .mockResolvedValueOnce(response({ prefs: DEFAULT_PREFS, version }))
  );
  editor();
  await screen.findByText("Sem conexão");
  expect(screen.getByLabelText("Apelido")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Tentar carregar novamente" }));
  await waitFor(() => expect(screen.getByLabelText("Apelido")).toBeEnabled());
});
it.each([{ motion: "reduced" as const }, { tutorPace: "instant" as const }])(
  "respects saved instant/reduced-motion preferences %j",
  (patch) => {
    render(
      <PreferencesProvider initialPrefs={{ ...DEFAULT_PREFS, ...patch }}>
        <TutorMessage animate content="**Olá**, vamos aprender." />
      </PreferencesProvider>
    );
    expect(screen.queryByRole("button", { name: "Mostrar tudo agora" })).not.toBeInTheDocument();
  }
);

it("guards navigation with the shared dialog and preserves the draft when staying", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ prefs: DEFAULT_PREFS, version })));
  editor();
  await waitFor(() => expect(screen.getByLabelText("Apelido")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Apelido"), { target: { value: "Lia" } });
  const link = document.createElement("a");
  link.href = "/student/tutor";
  document.body.append(link);
  fireEvent.click(link);
  expect(screen.getByRole("dialog", { name: "Sair sem salvar?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Apelido")).toHaveValue("Lia");
  link.remove();
});
