import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

test.describe("comparativo", () => {
  test("featured card links include ?services= with comma-separated slugs", async ({ page }) => {
    await page.goto("/pt/comparativo");

    const firstCard = page.locator('[data-slot="featured-comparativo-card"]').first();
    await expect(firstCard).toBeVisible();

    const href = await firstCard.getAttribute("href");
    expect(href).toMatch(/\/comparativo\?services=[a-z0-9-]+(,[a-z0-9-]+)+/);
  });

  test("navigating with ?services= for 4 slugs sets the OG image URL to cover that selection", async ({
    page,
  }) => {
    // Use 4 slugs from the seeded catalog (covers the max comparativo range)
    const services = "receita-federal,meu-inss,e-cac,fgts-caixa";
    await page.goto(`/pt/comparativo?services=${services}`);

    const ogImage = await page.getAttribute('meta[property="og:image"]', "content");
    expect(ogImage).not.toBeNull();
    expect(ogImage).toContain("opengraph-image");
    expect(ogImage).toContain(encodeURIComponent(services));
  });

  test("the comparativo landing page has no axe violations (WCAG 2 A/AA)", async ({ page }) => {
    await page.goto("/pt/comparativo");
    await expect(page.locator('[data-slot="featured-comparativos"]')).toBeVisible();

    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
