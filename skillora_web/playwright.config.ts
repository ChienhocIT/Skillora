import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SKILLORA_E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.SKILLORA_E2E_STANDALONE === "true" ? undefined : {
    command: "npm run dev -- --webpack --hostname 127.0.0.1",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
