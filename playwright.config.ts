import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const IS_CI = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(IS_CI
      ? []
      : [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]),
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_WEBSERVER_CMD ??
      (IS_CI ? "node .next/standalone/server.js" : "pnpm dev"),
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
