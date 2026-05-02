import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { LatencyChart } from "@/components/charts/latency-chart";
import { type UptimeBarPoint, UptimeBars } from "@/components/charts/uptime-bars";
import { IncidentsTable } from "@/components/incidents-table";
import { ShareButtons } from "@/components/share-buttons";
import { SLABox } from "@/components/sla-box";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { listIncidents } from "@/lib/queries/incidents";
import {
  getDailyUptimeBars,
  getLatencyByWindow,
  getYearToDateSummary,
} from "@/lib/queries/service-detail";
import { getServiceBySlug, listServices, type ServiceRow } from "@/lib/queries/services";
import { getMonthSummary } from "@/lib/queries/uptime";
import { serializeJsonLd } from "@/lib/seo/home-jsonld";
import { buildServiceJsonLd } from "@/lib/seo/service-jsonld";

export const revalidate = 60;

const FALLBACK_SITE_URL = "http://localhost:3000";

const loadService = cache((slug: string) => getServiceBySlug(db, slug));

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export async function generateStaticParams() {
  try {
    const services = await listServices(db, { activeOnly: true });
    return routing.locales.flatMap((locale) => services.map((s) => ({ locale, slug: s.slug })));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: requested, slug } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const service = await loadService(slug);
  if (!service) notFound();

  const t = await getTranslations({ locale, namespace: "ServiceDetail" });
  const url = siteUrl();
  const canonical = `${url}/${locale}/servico/${slug}`;
  const title = t("metaTitle", { name: service.name });
  const description = t("metaDescription", { name: service.name, agency: service.agency });

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${url}/${l}/servico/${slug}`])),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      locale,
      images: [`${url}/${locale}/opengraph-image`],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const service = await loadService(slug);
  if (!service) notFound();

  const now = new Date();
  const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [
    t,
    tHome,
    tCategories,
    dailyBars,
    latencyWindows,
    currentMonthSummary,
    previousMonthSummary,
    ytdSummary,
    incidentRows,
  ] = await Promise.all([
    getTranslations("ServiceDetail"),
    getTranslations("Home"),
    getTranslations("Categories"),
    getDailyUptimeBars(db, slug, 90, { now }),
    getLatencyByWindow(db, slug, { now }),
    getMonthSummary(db, slug, now),
    getMonthSummary(db, slug, previousMonthDate),
    getYearToDateSummary(db, slug, { now }),
    listIncidents(db, { serviceSlug: slug, limit: 200 }),
  ]);

  const incidentCountByDay = new Map<number, number>();
  for (const incident of incidentRows) {
    const dayStart = Date.UTC(
      incident.startedAt.getUTCFullYear(),
      incident.startedAt.getUTCMonth(),
      incident.startedAt.getUTCDate(),
    );
    incidentCountByDay.set(dayStart, (incidentCountByDay.get(dayStart) ?? 0) + 1);
  }
  const uptimeBarsData: UptimeBarPoint[] = dailyBars.map((p) => ({
    date: p.date,
    uptimePct: p.uptimePct,
    incidentCount: incidentCountByDay.get(p.date.getTime()) ?? 0,
  }));

  const canonicalUrl = `${siteUrl()}/${locale}/servico/${slug}`;

  const jsonLd = serializeJsonLd(
    buildServiceJsonLd({
      siteUrl: siteUrl(),
      locale,
      brandName: tHome("heading"),
      service: {
        slug: service.slug,
        name: service.name,
        agency: service.agency,
        // Use the stable category slug (locale-independent) as the schema.org
        // `serviceType` so the same service emits the same taxonomy value
        // across locales. The localized label only feeds the breadcrumb.
        serviceType: service.category,
        description: service.description,
        officialUrl: service.url,
      },
      category: {
        key: service.category,
        label: tCategoryLabel(tCategories, service.category),
      },
    }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined; serializeJsonLd escapes `<` to keep the tag safe.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
        <ServiceHeader service={service} t={t} />
        <ShareButtons url={canonicalUrl} serviceName={service.name} />
        <section data-slot="service-detail-uptime" aria-label="Uptime">
          <UptimeBars data={uptimeBarsData} serviceName={service.name} />
        </section>
        <section data-slot="service-detail-latency" aria-label="Latency">
          <LatencyChart windows={latencyWindows} serviceName={service.name} />
        </section>
        <section data-slot="service-detail-sla" aria-label="SLA">
          <SLABox
            target={null}
            currentMonth={currentMonthSummary.uptimePct}
            previousMonth={previousMonthSummary.uptimePct}
            yearToDate={ytdSummary.uptimePct}
            now={now}
          />
        </section>
        <section data-slot="service-detail-incidents" aria-label="Incidents">
          <IncidentsTable incidents={incidentRows} now={now} />
        </section>
      </div>
    </>
  );
}

function tCategoryLabel(
  tCategories: Awaited<ReturnType<typeof getTranslations<"Categories">>>,
  category: string,
): string {
  // `services.category` is a free-form text column; we cast through `never` to
  // ask next-intl about an arbitrary string key. Falls back to the raw slug if
  // the category isn't in the Categories namespace, so a future seed value
  // doesn't break the page.
  return tCategories.has(category as never) ? tCategories(category as never) : category;
}

function ServiceHeader({
  service,
  t,
}: {
  service: ServiceRow;
  t: Awaited<ReturnType<typeof getTranslations<"ServiceDetail">>>;
}) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {service.name}
      </h1>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-2">
          <dt className="font-medium text-foreground/80">{t("agencyLabel")}:</dt>
          <dd>{service.agency}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="font-medium text-foreground/80">{t("sphereLabel")}:</dt>
          <dd>{t(`sphere.${service.sphere}`)}</dd>
        </div>
      </dl>
      {service.description ? (
        <p className="max-w-3xl text-balance text-base text-muted-foreground">
          {service.description}
        </p>
      ) : null}
      <a
        href={service.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("officialLink")} <span aria-hidden>↗</span>
      </a>
    </header>
  );
}
