import { expect, it } from "vitest";
import { ACCENT_CHOICES, DEFAULT_PREFS, THEMES, normalizePrefs } from "@/lib/theme";

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((value) => {
      const channel = Number.parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
it("keeps every selectable accent readable with white button text", () => {
  const accents = [
    ...ACCENT_CHOICES.filter((color) => color !== "auto"),
    ...Object.values(THEMES).map((theme) => theme.accent),
  ];
  for (const color of accents) expect(1.05 / (luminance(color) + 0.05), color).toBeGreaterThanOrEqual(4.5);
});
it("normalizes legacy or tampered preferences without CSS or identity injection", () => {
  expect(
    normalizePrefs({ theme: "__proto__", accent: "#FFFFFF", nickname: "<img>", radius: 500, tutorPace: "unknown" })
  ).toEqual(DEFAULT_PREFS);
  expect(normalizePrefs({ theme: "royal", nickname: "  Lia  ", motion: "reduced" })).toMatchObject({
    theme: "royal",
    nickname: "Lia",
    motion: "reduced",
    tutorPace: "calm",
  });
});
