import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CsvExportButton } from "@/components/services/csv-export-button";
import { SortableServicesTable } from "@/components/services/sortable-table";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getServicesByCategoryStatus } from "@/lib/queries/services";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Ranking" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RankingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Ranking");
  const groups = await getServicesByCategoryStatus(db);
  const services = groups.flatMap((g) => g.services);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <section aria-labelledby="ranking-heading" className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 id="ranking-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("heading")}
          </h1>
          <Suspense>
            <CsvExportButton className="mt-1 shrink-0" />
          </Suspense>
        </div>
        <p className="text-base text-muted-foreground">{t("tagline")}</p>
      </section>

      <SortableServicesTable services={services} defaultSortId="uptime1h" defaultSortDir="asc" />
    </div>
  );
}
