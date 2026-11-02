import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    // worktrees do Claude Code (.claude/) têm cópias do repo: não rodar os testes delas
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
  },
});
