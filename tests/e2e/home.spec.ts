import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("home", () => {
  test("/pt returns 200 and renders a visible H1", async ({ page }) => {
    const response = await page.goto("/pt");
    expect(response, "navigation response").not.toBeNull();
    expect(response?.status(), "final response status").toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("renders at least one ServiceStatusCard", async ({ page }) => {
    await page.goto("/pt");
    const cards = page.locator('[data-slot="service-status-card"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("has no axe-playwright violations", async ({ page }) => {
    await page.goto("/pt");
    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });

  test("theme toggle switches the html class from light to dark", async ({ page }) => {
    await page.goto("/pt");
    await page.evaluate(() => window.localStorage.setItem("theme", "light"));
    await page.reload();

    const html = page.locator("html");
    await expect(html).toHaveClass(/(?:^|\s)light(?:\s|$)/);

    await page.getByRole("button", { name: /Alternar tema/i }).click();

    await expect(html).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  });
});
