import { describe, it, expect } from "vitest";
import { fmtBRL, fmtNum, formatDate, formatDateTime, getInitials, cx, cn } from "@/lib/utils";

describe("fmtBRL", () => {
  it("formats positive number", () => {
    expect(fmtBRL(1000)).toBe("R$ 1.000,00");
  });
  it("formats decimal", () => {
    expect(fmtBRL(99.9)).toBe("R$ 99,90");
  });
  it("handles string input", () => {
    expect(fmtBRL("250.5")).toBe("R$ 250,50");
  });
  it("handles zero", () => {
    expect(fmtBRL(0)).toBe("R$ 0,00");
  });
});

describe("fmtNum", () => {
  it("formats with pt-BR separator", () => {
    expect(fmtNum(1000)).toBe("1.000");
  });
  it("handles string", () => {
    expect(fmtNum("500")).toBe("500");
  });
});

describe("getInitials", () => {
  it("returns first 2 words' initials", () => {
    // "João da Silva" → slice(0,2) = ["João","da"] → "JD"
    expect(getInitials("João da Silva")).toBe("JD");
  });
  it("handles single name (1 char)", () => {
    // 1 word → 1 initial
    expect(getInitials("Admin")).toBe("A");
  });
  it("returns 2 initials for two-word name", () => {
    expect(getInitials("Ana Paula")).toBe("AP");
  });
  it("uppercases", () => {
    expect(getInitials("ana paula")).toBe("AP");
  });
});

describe("cx", () => {
  it("joins truthy classes", () => {
    expect(cx("a", "b", false, null, "c")).toBe("a b c");
  });
  it("returns empty string for all falsy", () => {
    expect(cx(false, null, undefined)).toBe("");
  });
});

describe("formatDate", () => {
  it("returns pt-BR date string with correct day", () => {
    // Usar data local (sem UTC offset) para evitar flip de dia por timezone
    const result = formatDate(new Date(2026, 0, 15)); // local Jan 15
    expect(result).toMatch(/15/);
  });
});

describe("formatDateTime", () => {
  it("shows lesson times in Brasilia even on a UTC server", () => {
    expect(formatDateTime("2026-11-18T22:00:00Z")).toBe("18/11/2026, 19:00");
    expect(formatDateTime("2026-11-19T01:30:00Z")).toBe("18/11/2026, 22:30");
  });
});
