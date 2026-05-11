import { expect, test } from "@playwright/test";

test.describe("incidents", () => {
  test("/pt/incidentes renders the timeline with at least one row", async ({ page }) => {
    await page.goto("/pt/incidentes");
    await expect(page.locator('[data-slot="incident-filters"]')).toBeVisible();
    // The incidents table should contain at least one row (seeded data)
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("filter by service slug updates the URL query string", async ({ page }) => {
    await page.goto("/pt/incidentes");
    await expect(page.locator('[data-slot="incident-filters"]')).toBeVisible();

    const select = page.locator("#filter-service");
    await expect(select).toBeVisible();

    // Pick the first non-empty option
    const options = select.locator("option");
    const count = await options.count();
    if (count <= 1) {
      test.skip(count <= 1, "No service options available in this environment");
      return;
    }

    const firstValue = await options.nth(1).getAttribute("value");
    await select.selectOption({ index: 1 });

    await page.waitForURL((url) => url.searchParams.has("service"), { timeout: 5_000 });
    expect(new URL(page.url()).searchParams.get("service")).toBe(firstValue);
  });

  test("filter roundtrip: URL params are reflected in the select element", async ({ page }) => {
    // Navigate with a service filter pre-set — the select should reflect it
    const response = await page.goto("/pt/incidentes?service=gov-br&severity=partial");
    expect(response?.status()).toBe(200);

    const serviceSelect = page.locator("#filter-service");
    await expect(serviceSelect).toBeVisible();
    await expect(serviceSelect).toHaveValue("gov-br");

    const severitySelect = page.locator("#filter-severity");
    await expect(severitySelect).toBeVisible();
    await expect(severitySelect).toHaveValue("partial");
  });

  test("deep-link to a specific incident renders its detail page", async ({ page }) => {
    // First, visit the timeline to capture an incident link
    await page.goto("/pt/incidentes");
    const rows = page.locator("table tbody tr");
    const firstRowLink = rows.first().locator("a").first();
    await expect(firstRowLink).toBeVisible({ timeout: 10_000 });

    const href = await firstRowLink.getAttribute("href");
    if (!href) {
      test.skip(!href, "No incident links found in table");
      return;
    }

    // Navigate to the incident detail page
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});
