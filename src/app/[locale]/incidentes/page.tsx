import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { IncidentFilters } from "@/components/incidentes/filters";
import { IncidentsTable } from "@/components/incidents-table";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { type IncidentSeverity, listIncidents } from "@/lib/queries/incidents";
import { listServices } from "@/lib/queries/services";

export const revalidate = 60;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Incidentes" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function IncidentesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    service?: string;
    severity?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const t = await getTranslations("Incidentes");

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - NINETY_DAYS_MS);

  const severityParam =
    sp.severity === "partial" || sp.severity === "total"
      ? (sp.severity as IncidentSeverity)
      : undefined;

  const fromDate = sp.from ? new Date(sp.from) : defaultFrom;
  const toDate = sp.to ? new Date(sp.to) : undefined;

  const [services, incidents] = await Promise.all([
    listServices(db, { activeOnly: true }),
    listIncidents(db, {
      serviceSlug: sp.service ?? undefined,
      severity: severityParam,
      from: fromDate,
      to: toDate,
      limit: 200,
    }),
  ]);

  const serviceNames: Record<string, string> = Object.fromEntries(
    services.map((s) => [s.slug, s.name]),
  );

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <section aria-labelledby="incidentes-heading" className="flex flex-col gap-2">
        <h1 id="incidentes-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("tagline")}</p>
      </section>

      <Suspense>
        <IncidentFilters services={services} />
      </Suspense>

      <IncidentsTable incidents={incidents} pageSize={50} serviceNames={serviceNames} />
    </div>
  );
}
