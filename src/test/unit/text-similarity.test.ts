import { describe, it, expect } from "vitest";
import { levenshtein, similarityRatio, bestSimilarity, normalizeText } from "@/lib/text-similarity";

describe("levenshtein", () => {
  it("zero para strings iguais", () => {
    expect(levenshtein("casa", "casa")).toBe(0);
  });
  it("conta edições", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
  it("string vazia", () => {
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("normalizeText", () => {
  it("remove acento e caixa", () => {
    expect(normalizeText("Café")).toBe("cafe");
  });
  it("colapsa espaços", () => {
    expect(normalizeText("  hello   world ")).toBe("hello world");
  });
});

describe("similarityRatio", () => {
  it("1 para idênticos (ignora acento/caixa)", () => {
    expect(similarityRatio("Nice to meet you", "nice to meet you")).toBe(1);
  });
  it("alta para quase iguais", () => {
    expect(similarityRatio("nice to meet you", "nice to meet yo")).toBeGreaterThan(0.9);
  });
  it("baixa para diferentes", () => {
    expect(similarityRatio("hello", "goodbye")).toBeLessThan(0.5);
  });
});

describe("bestSimilarity", () => {
  it("pega a melhor entre aceitas", () => {
    const r = bestSimilarity("pleased to meet you", ["nice to meet you", "pleased to meet you"]);
    expect(r).toBe(1);
  });
});
