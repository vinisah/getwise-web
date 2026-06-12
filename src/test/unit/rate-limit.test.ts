import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

// Determinismo: controlar relógio
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows first request", () => {
    const result = checkRateLimit("test-ip-1", 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks after max attempts", () => {
    const id = "test-ip-2";
    checkRateLimit(id, 2, 60_000);
    checkRateLimit(id, 2, 60_000);
    const blocked = checkRateLimit(id, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const id = "test-ip-3";
    checkRateLimit(id, 1, 60_000);
    checkRateLimit(id, 1, 60_000); // should be blocked

    // Avança o relógio além da janela
    vi.advanceTimersByTime(61_000);

    const result = checkRateLimit(id, 1, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("different identifiers are independent", () => {
    const id1 = "test-ip-4a";
    const id2 = "test-ip-4b";
    checkRateLimit(id1, 1, 60_000);
    checkRateLimit(id1, 1, 60_000); // id1 blocked

    const result = checkRateLimit(id2, 1, 60_000);
    expect(result.allowed).toBe(true); // id2 independente
  });
});

describe("resetRateLimit", () => {
  it("allows requests after reset", () => {
    const id = "test-ip-5";
    checkRateLimit(id, 1, 60_000);
    checkRateLimit(id, 1, 60_000); // blocked

    resetRateLimit(id);
    const result = checkRateLimit(id, 1, 60_000);
    expect(result.allowed).toBe(true);
  });
});
