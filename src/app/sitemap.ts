import "server-only";
import { desc, gte, inArray, max } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { listServices } from "@/lib/queries/services";

export const revalidate = 3600;

const FALLBACK_SITE_URL = "http://localhost:3000";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

type SitemapEntry = MetadataRoute.Sitemap[number];
type ChangeFreq = NonNullable<SitemapEntry["changeFrequency"]>;

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: ChangeFreq }> = [
  { path: "", priority: 1.0, changeFrequency: "hourly" },
  { path: "/ranking", priority: 0.9, changeFrequency: "hourly" },
  { path: "/comparativo", priority: 0.8, changeFrequency: "daily" },
  { path: "/incidentes", priority: 0.8, changeFrequency: "hourly" },
  { path: "/metodologia", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacidade", priority: 0.3, changeFrequency: "yearly" },
];

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

function localeEntry(base: string, path: string, lastModified?: Date): SitemapEntry {
  return {
    url: `${base}/pt${path}`,
    lastModified,
    alternates: {
      languages: {
        pt: `${base}/pt${path}`,
        en: `${base}/en${path}`,
      },
    },
  };
}

function toDate(val: Date | string | null | undefined): Date | undefined {
  if (!val) return undefined;
  return val instanceof Date ? val : new Date(val as string);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase();
  const since = new Date(Date.now() - NINETY_DAYS_MS);

  let serviceRows: Awaited<ReturnType<typeof listServices>> = [];
  let incidentRows: { id: string; startedAt: Date }[] = [];
  const lastmodBySlug = new Map<string, Date>();

  try {
    const [svcs, incs] = await Promise.all([
      listServices(db, { activeOnly: true }),
      db
        .select({ id: incidents.id, startedAt: incidents.startedAt })
        .from(incidents)
        .where(gte(incidents.startedAt, since))
        .orderBy(desc(incidents.startedAt)),
    ]);

    serviceRows = svcs;
    incidentRows = incs;

    if (svcs.length > 0) {
      const slugs = svcs.map((s) => s.slug);
      const lastmods = await db
        .select({
          serviceSlug: incidents.serviceSlug,
          latestAt: max(incidents.startedAt),
        })
        .from(incidents)
        .where(inArray(incidents.serviceSlug, slugs))
        .groupBy(incidents.serviceSlug);

      for (const row of lastmods) {
        const d = toDate(row.latestAt);
        if (d) lastmodBySlug.set(row.serviceSlug, d);
      }
    }
  } catch {
    // DB unavailable (e.g., cold build without DATABASE_URL) — degrade to static pages only
  }

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(
    ({ path, priority, changeFrequency }) => ({
      ...localeEntry(base, path),
      priority,
      changeFrequency,
    }),
  );

  const serviceEntries: MetadataRoute.Sitemap = serviceRows.map((svc) => ({
    ...localeEntry(base, `/servico/${svc.slug}`, lastmodBySlug.get(svc.slug) ?? svc.createdAt),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  const incidentEntries: MetadataRoute.Sitemap = incidentRows.map((inc) => ({
    ...localeEntry(base, `/incidentes/${inc.id}`, inc.startedAt),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    { url: `${base}/api/docs`, changeFrequency: "monthly", priority: 0.4 },
    ...serviceEntries,
    ...incidentEntries,
  ];
}
