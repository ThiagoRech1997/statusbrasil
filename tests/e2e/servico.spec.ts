import { expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

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

  test("clicking a card on the home navigates to the matching service detail", async ({ page }) => {
    await page.goto("/pt");
    const firstCard = page.locator('[data-slot="service-status-card"]').first();
    await expect(firstCard).toBeVisible();
    const href = await firstCard.getAttribute("href");
    expect(href, "card href").toBeTruthy();

    await Promise.all([page.waitForURL(/\/pt\/servico\/[a-z0-9-]+/), firstCard.click()]);
    expect(page.url()).toContain("/pt/servico/");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("renders UptimeBars, LatencyChart, IncidentsTable and SLABox components", async ({
    page,
  }) => {
    await page.goto(`/pt/servico/${KNOWN_SLUG}`);

    await expect(page.locator('[data-slot="uptime-bars"]')).toBeVisible();
    await expect(page.locator('[data-slot="latency-chart"]')).toBeVisible();
    // IncidentsTable renders either the table+cards layout OR the empty-state placeholder.
    await expect(
      page.locator('[data-slot="incidents-table"], [data-slot="incidents-table-empty"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-slot="sla-box"]')).toBeVisible();
  });

  test("LatencyChart 1d/7d/30d/90d toggle flips aria-pressed correctly", async ({ page }) => {
    await page.goto(`/pt/servico/${KNOWN_SLUG}`);

    const toggle = page.locator('[data-slot="latency-window-toggle"]');
    await expect(toggle).toBeVisible();

    const button1d = toggle.locator('[data-window="1d"]');
    const button7d = toggle.locator('[data-window="7d"]');
    const button30d = toggle.locator('[data-window="30d"]');

    // The component defaults to 7d.
    await expect(button7d).toHaveAttribute("aria-pressed", "true");
    await expect(button1d).toHaveAttribute("aria-pressed", "false");

    await button1d.click();
    await expect(button1d).toHaveAttribute("aria-pressed", "true");
    await expect(button7d).toHaveAttribute("aria-pressed", "false");

    await button30d.click();
    await expect(button30d).toHaveAttribute("aria-pressed", "true");
    await expect(button1d).toHaveAttribute("aria-pressed", "false");
  });

  test("has no axe-playwright violations", async ({ page }) => {
    await page.goto(`/pt/servico/${KNOWN_SLUG}`);
    // Wait for the chart and SLA box to render before scanning.
    await expect(page.locator('[data-slot="latency-chart"]')).toBeVisible();
    await expect(page.locator('[data-slot="sla-box"]')).toBeVisible();

    await injectAxe(page);
    const violations = await getViolations(page, undefined, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    expect(violations, `axe violations:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
