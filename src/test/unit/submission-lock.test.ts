import { describe, it, expect } from "vitest";
import { acquireLock, releaseLock, submissionKey } from "@/lib/submission-lock";

describe("submission-lock (dedupe)", () => {
  it("primeira aquisição passa, segunda bloqueia", async () => {
    const k = submissionKey("u1", "e1");
    expect(await acquireLock(k)).toBe(true);
    expect(await acquireLock(k)).toBe(false); // já em processamento
    await releaseLock(k);
    expect(await acquireLock(k)).toBe(true); // liberado
    await releaseLock(k);
  });

  it("chaves diferentes são independentes", async () => {
    const a = submissionKey("u1", "e1");
    const b = submissionKey("u1", "e2");
    expect(await acquireLock(a)).toBe(true);
    expect(await acquireLock(b)).toBe(true);
    await releaseLock(a);
    await releaseLock(b);
  });
});
