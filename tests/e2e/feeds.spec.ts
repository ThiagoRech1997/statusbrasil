import { expect, test } from "@playwright/test";

test.describe("feeds", () => {
  test("/feed.xml returns 200 with RSS content-type", async ({ request }) => {
    const response = await request.get("/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/rss+xml");
  });

  test("/atom.xml returns 200 with Atom content-type", async ({ request }) => {
    const response = await request.get("/atom.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/atom+xml");
  });

  test("/feed.xml body is valid RSS XML with expected channel structure", async ({ request }) => {
    const response = await request.get("/feed.xml");
    const body = await response.text();

    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain("<channel>");
    expect(body).toContain("<title>Status Brasil — Incidentes</title>");
    expect(body).toContain("</channel>");
    expect(body).toContain("</rss>");
  });

  test("/atom.xml body is valid Atom XML with expected feed structure", async ({ request }) => {
    const response = await request.get("/atom.xml");
    const body = await response.text();

    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).toContain("<title>Status Brasil — Incidentes</title>");
    expect(body).toContain("</feed>");
  });
});
