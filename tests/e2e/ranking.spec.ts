import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("ranking", () => {
  test("sort header click updates the URL with the sort param", async ({ page }) => {
    await page.goto("/pt/ranking");
    await expect(page.locator('[data-slot="sortable-services-table"]')).toBeVisible();

    // Click the Status sort header (initially unsorted → first click goes asc)
    const statusBtn = page.getByRole("button", { name: /ordenar por status/i });
    await statusBtn.click();

    await expect(page).toHaveURL(/sort=status/);
    await expect(page).toHaveURL(/dir=asc/);
  });

  test("URL sort state is preserved across a page reload", async ({ page }) => {
    // Navigate with pre-set sort params
    await page.goto("/pt/ranking?sort=status&dir=desc");
    await expect(page.locator('[data-slot="sortable-services-table"]')).toBeVisible();

    await page.reload();

    // URL must still carry the sort state (nuqs reads from query string)
    expect(page.url()).toMatch(/sort=status/);
    expect(page.url()).toMatch(/dir=desc/);

    // Table must still be rendered after reload
    await expect(page.locator('[data-slot="sortable-services-table"]')).toBeVisible();
  });

  test("has no axe violations (WCAG 2 A/AA)", async ({ page }) => {
    await page.goto("/pt/ranking");
    await expect(page.locator('[data-slot="sortable-services-table"]')).toBeVisible();

    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
