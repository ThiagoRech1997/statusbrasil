import { expect, test } from "@playwright/test";

test.describe("sitemap", () => {
  test("/sitemap.xml returns 200", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
  });

  test("/sitemap.xml is valid XML with a <urlset> root element", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();

    expect(body).toContain('<?xml version="1.0"');
    expect(body).toContain("<urlset");
    expect(body).toContain("</urlset>");
    expect(body).toContain("<url>");
    expect(body).toContain("<loc>");
  });

  test("/sitemap.xml contains the home page URL", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    const body = await response.text();
    expect(body).toMatch(/<loc>[^<]*\/pt<\/loc>/);
  });

  test("/robots.txt returns 200 with a Sitemap directive", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("/sitemap.xml");
  });
});
