import { expect, test } from "@playwright/test";

const KNOWN_SLUG = "gov-br";
const UNKNOWN_SLUG = "__not-a-real-service__";

test.describe("/[locale]/servico/[slug]", () => {
  test("known slug returns 200 and renders the service H1", async ({ page }) => {
    const response = await page.goto(`/pt/servico/${KNOWN_SLUG}`);
    expect(response?.status(), "final response status").toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("unknown slug returns 404", async ({ page }) => {
    const response = await page.goto(`/pt/servico/${UNKNOWN_SLUG}`);
    expect(response?.status(), "final response status").toBe(404);
  });

  test("english locale renders with localized officialLink label", async ({ page }) => {
    const response = await page.goto(`/en/servico/${KNOWN_SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: /Open official site/i })).toBeVisible();
  });
});
