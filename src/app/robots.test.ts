// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  it("includes a Sitemap directive pointing to /sitemap.xml", () => {
    const result = robots();
    const sitemapUrl = result.sitemap;
    expect(sitemapUrl).toBeDefined();
    expect(sitemapUrl).toContain("/sitemap.xml");
  });

  it("allows all crawlers", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.userAgent).toBe("*");
    expect(rules?.allow).toBe("/");
  });

  it("uses NEXT_PUBLIC_SITE_URL as the sitemap base", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://statusbrasil.org";
    const result = robots();
    expect(result.sitemap).toBe("https://statusbrasil.org/sitemap.xml");
  });
});
