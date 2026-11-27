import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApplicationDetail } from "@/components/enrollment/application-detail";
import { adultApplication } from "@/test/fixtures/pre-enrollment";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const entry = {
  id: "legacy",
  protocol: "LEGACY",
  version: 3,
  status: "APPROVED",
  geographyRequired: false,
  feedback: "",
  studentId: "student",
  data: { ...adultApplication, student: { ...adultApplication.student, zipCode: "00000000" } },
  schoolUnit: { name: "Marechal" },
  course: { title: "A1" },
  applicant: { emailVerified: "2026-11-26" },
};
beforeEach(() => {
  cleanup();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(entry))
  );
});
describe("Regularização de pré-matrícula legada aprovada", () => {
  it("permite secretaria reabrir com motivo e mantém o histórico/cadastro", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      init?.method === "POST" ? Response.json({ ok: true }) : Response.json(entry)
    );
    render(<ApplicationDetail id="legacy" admin />);
    expect(await screen.findByRole("heading", { name: "Regularização antes da matrícula" })).toBeInTheDocument();
    expect(screen.getByText(/Cadastro anterior à consulta de CEP/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar dados" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Mensagem para a família/), {
      target: { value: "Informe o CEP residencial atual para regularizar a unidade." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar ajustes" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/pre-enrollments/legacy",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            version: 3,
            action: "CORRECTION",
            feedback: "Informe o CEP residencial atual para regularizar a unidade.",
          }),
        })
      )
    );
  });
  it("não oferece reabertura de matrícula já efetivada", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...entry, status: "ENROLLED" }));
    render(<ApplicationDetail id="legacy" admin />);
    await screen.findByText("Matrícula efetivada");
    expect(screen.queryByRole("button", { name: "Solicitar ajustes" })).not.toBeInTheDocument();
  });
});
