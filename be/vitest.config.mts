import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{js,ts}", "tests/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.js"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "src/scripts/**",
        "src/server.js",
      ],
      reportOnFailure: true,
    },
  },
});


