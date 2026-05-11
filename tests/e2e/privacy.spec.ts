import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("privacy", () => {
  test("/pt/privacidade returns 200 and renders an H1", async ({ page }) => {
    const response = await page.goto("/pt/privacidade");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("/pt/privacidade has no axe violations (WCAG 2 A/AA)", async ({ page }) => {
    await page.goto("/pt/privacidade");
    await expect(page.locator("h1").first()).toBeVisible();

    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
