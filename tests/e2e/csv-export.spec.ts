import { expect, test } from "@playwright/test";

test.describe("csv-export", () => {
  test("clicking 'Exportar CSV' triggers a file download with the correct filename pattern", async ({
    page,
  }) => {
    await page.goto("/pt/ranking");

    const exportLink = page.getByRole("link", { name: /exportar csv/i });
    await expect(exportLink).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await exportLink.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^statusbrasil-ranking-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("CSV endpoint returns UTF-8 BOM as the first three bytes", async ({ request }) => {
    const response = await request.get("/api/v1/services.csv");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const buffer = await response.body();
    // UTF-8 BOM: 0xEF 0xBB 0xBF
    expect(buffer[0]).toBe(0xef);
    expect(buffer[1]).toBe(0xbb);
    expect(buffer[2]).toBe(0xbf);
  });

  test("CSV endpoint with active filters passes them through and returns a valid CSV", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/services.csv?sphere=federal");
    expect(response.status()).toBe(200);

    const text = await response.text();
    // Should have header line
    expect(text).toContain("slug,name,agency");
    // Should use CRLF line endings
    expect(text).toContain("\r\n");
  });
});
