import { describe, it, expect } from "vitest";
import { gradeAnswer } from "@/lib/services/grading";

const ex = (type: string, correctAnswer: unknown) => ({ type, correctAnswer, points: 10 });

describe("gradeAnswer", () => {
  it("MULTIPLE_CHOICE: correto = 100/passed", () => {
    const r = gradeAnswer(ex("MULTIPLE_CHOICE", "Ay"), "Ay");
    expect(r.passed).toBe(true);
    expect(r.scorePercent).toBe(100);
  });
  it("MULTIPLE_CHOICE: errado = 0", () => {
    expect(gradeAnswer(ex("MULTIPLE_CHOICE", "Ay"), "Bee").passed).toBe(false);
  });

  it("TRUE_FALSE: case-insensitive", () => {
    expect(gradeAnswer(ex("TRUE_FALSE", "True"), "true").passed).toBe(true);
  });

  it("FILL_IN_BLANK: aceita sinônimos (array)", () => {
    expect(gradeAnswer(ex("FILL_IN_BLANK", ["good", "Good"]), "GOOD").passed).toBe(true);
  });
  it("FILL_IN_BLANK: ignora acento", () => {
    expect(gradeAnswer(ex("FILL_IN_BLANK", ["café"]), "cafe").passed).toBe(true);
  });

  it("SENTENCE_ORDER: ordem correta passa", () => {
    expect(gradeAnswer(ex("SENTENCE_ORDER", ["I", "am", "happy"]), ["I", "am", "happy"]).passed).toBe(true);
  });
  it("SENTENCE_ORDER: ordem errada falha", () => {
    expect(gradeAnswer(ex("SENTENCE_ORDER", ["I", "am", "happy"]), ["am", "I", "happy"]).passed).toBe(false);
  });

  it("WORD_MATCH: pares certos passam (ordem irrelevante)", () => {
    const correct = [["dog", "cachorro"], ["cat", "gato"]];
    const answer = [["cat", "gato"], ["dog", "cachorro"]];
    expect(gradeAnswer(ex("WORD_MATCH", correct), answer).passed).toBe(true);
  });

  it("TRANSLATION: similaridade >= 0.8 passa", () => {
    const r = gradeAnswer(ex("TRANSLATION", ["nice to meet you"]), "nice to meet yo");
    expect(r.passed).toBe(true);
    expect(r.scorePercent).toBeGreaterThanOrEqual(80);
  });
  it("TRANSLATION: muito diferente falha", () => {
    expect(gradeAnswer(ex("TRANSLATION", ["nice to meet you"]), "hello").passed).toBe(false);
  });

  it("DICTATION/PRONUNCIATION: stub", () => {
    expect(gradeAnswer(ex("DICTATION", "x"), "x").stub).toBe(true);
    expect(gradeAnswer(ex("PRONUNCIATION", "x"), "x").stub).toBe(true);
  });
});
