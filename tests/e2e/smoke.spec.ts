import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("smoke", () => {
  test("home page renders 200 with a visible H1", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "navigation response").not.toBeNull();
    expect(response?.status(), "final response status").toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(page.url()).toMatch(/\/(pt|en)(\/|$)/);
  });

  test("/api/health returns 200 with expected shape", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        status: "ok",
        version: expect.any(String),
        uptime: expect.any(Number),
      }),
    );
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test("home page has no axe violations on the shell", async ({ page }) => {
    await page.goto("/");
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
