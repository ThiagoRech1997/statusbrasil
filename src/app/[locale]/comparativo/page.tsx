import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import {
  ComparativoStatsGrid,
  type ServiceStatsRow,
} from "@/components/comparativo/comparativo-stats-grid";
import { FeaturedComparativos } from "@/components/comparativo/featured-comparativos";
import { ServicePicker } from "@/components/comparativo/service-picker";
import { MultiLatencyChart, type MultiLatencyEntry } from "@/components/charts/multi-latency-chart";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import {
  getBatchRollingUptimeSummary,
  getBatchIncidentCount30d,
  getBatchMonthUptime,
} from "@/lib/queries/uptime";
import { getLatencyByWindow } from "@/lib/queries/service-detail";
import { listServices, getServiceWithStatusBySlug } from "@/lib/queries/services";

export const revalidate = 60;

const FALLBACK_SITE_URL = "http://localhost:3000";
const MAX_SERVICES = 4;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const t = await getTranslations({ locale, namespace: "Comparativo" });
  const url = siteUrl();
  const canonical = `${url}/${locale}/comparativo`;

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${url}/${l}/comparativo`])),
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: canonical,
      type: "website",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default async function ComparativoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ services?: string }>;
}) {
  const { locale } = await params;
  const { services: rawServices } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Comparativo");

  const slugs = rawServices
    ? rawServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const tooMany = slugs.length > MAX_SERVICES;
  const showComparison = !tooMany && slugs.length >= 2;

  // Always fetch all services for the picker dropdown
  const allServices = await listServices(db, { activeOnly: true });

  let comparisonRows: ServiceStatsRow[] = [];
  let latencyEntries: MultiLatencyEntry[] = [];

  if (showComparison) {
    const [serviceDetails, batchSummary, incidentCounts, monthUptime, latencyData] =
      await Promise.all([
        Promise.all(slugs.map((slug) => getServiceWithStatusBySlug(db, slug))),
        getBatchRollingUptimeSummary(db, slugs),
        getBatchIncidentCount30d(db, slugs),
        getBatchMonthUptime(db, slugs),
        Promise.all(slugs.map((slug) => getLatencyByWindow(db, slug))),
      ]);

    comparisonRows = slugs
      .map((slug, i) => {
        const svc = serviceDetails[i];
        if (!svc) return null;
        const summary = batchSummary.get(slug);
        return {
          slug,
          name: svc.name,
          agency: svc.agency,
          status: svc.status,
          uptime30dPct: summary?.uptime30dPct ?? null,
          mttr30dSeconds: summary?.mttr30dSeconds ?? null,
          incidents30d: incidentCounts.get(slug) ?? 0,
          currentMonthUptimePct: monthUptime.get(slug) ?? null,
        } satisfies ServiceStatsRow;
      })
      .filter((r): r is ServiceStatsRow => r != null);

    latencyEntries = slugs
      .map((slug, i) => {
        const svc = serviceDetails[i];
        const windows = latencyData[i];
        if (!svc || !windows) return null;
        return {
          slug,
          name: svc.name,
          windows,
        } satisfies MultiLatencyEntry;
      })
      .filter((e): e is MultiLatencyEntry => e != null);
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("heading")}
        </h1>
        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          {t("tagline")}
        </p>
      </header>

      {tooMany && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{t("errorTooMany")}</span>
        </div>
      )}

      <ServicePicker allServices={allServices} />

      {showComparison && comparisonRows.length >= 2 ? (
        <div className="flex flex-col gap-10">
          <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
            <h2
              id="stats-heading"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {t("statsHeading")}
            </h2>
            <ComparativoStatsGrid services={comparisonRows} />
          </section>

          <section aria-labelledby="latency-heading" className="flex flex-col gap-4">
            <h2
              id="latency-heading"
              className="font-heading text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {t("latencyHeading")}
            </h2>
            <MultiLatencyChart services={latencyEntries} />
          </section>
        </div>
      ) : (
        <FeaturedComparativos />
      )}
    </div>
  );
}
