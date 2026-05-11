import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("methodology", () => {
  test("/pt/metodologia returns 200 and renders an H1", async ({ page }) => {
    const response = await page.goto("/pt/metodologia");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/pt/metodologia has no axe violations (WCAG 2 A/AA)", async ({ page }) => {
    await page.goto("/pt/metodologia");
    await expect(page.locator("h1").first()).toBeVisible();

    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
