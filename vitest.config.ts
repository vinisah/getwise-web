import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Ordem fixa — sem aleatoriedade (determinismo)
    sequence: { shuffle: false },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/lib/prisma.ts"],
      // Piso conservador (abaixo do atual ~47%): trava regressão de cobertura sem bloquear hoje.
      // Subir gradualmente conforme novos testes entram.
      thresholds: { lines: 40, functions: 45, statements: 40, branches: 30 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
