import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{js,ts}", "tests/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
    },
  },
});


