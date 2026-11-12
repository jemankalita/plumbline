import { defineConfig, devices } from "@playwright/test";

// Runs against a server that is already up, so the same test can check a local build or the hosted site.
// Usage: E2E_BASE_URL=http://localhost:3200 npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", ...devices["Desktop Chrome"] },
});
