import type { MetadataRoute } from "next";

const FALLBACK_SITE_URL = "http://localhost:3000";

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/cron/", "/api/metrics", "/api/badge/"],
    },
    sitemap: `${siteBase()}/sitemap.xml`,
  };
}
