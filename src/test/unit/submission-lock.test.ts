import { describe, it, expect } from "vitest";
import { acquireLock, releaseLock, submissionKey } from "@/lib/submission-lock";

describe("submission-lock (dedupe)", () => {
  it("primeira aquisição passa, segunda bloqueia", () => {
    const k = submissionKey("u1", "e1");
    expect(acquireLock(k)).toBe(true);
    expect(acquireLock(k)).toBe(false); // já em processamento
    releaseLock(k);
    expect(acquireLock(k)).toBe(true); // liberado
    releaseLock(k);
  });

  it("chaves diferentes são independentes", () => {
    const a = submissionKey("u1", "e1");
    const b = submissionKey("u1", "e2");
    expect(acquireLock(a)).toBe(true);
    expect(acquireLock(b)).toBe(true);
    releaseLock(a);
    releaseLock(b);
  });
});
