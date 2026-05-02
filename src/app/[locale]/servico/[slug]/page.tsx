import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getServiceBySlug, listServices, type ServiceRow } from "@/lib/queries/services";

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

  const t = await getTranslations("ServiceDetail");

  return <ServiceHeader service={service} t={t} />;
}

function ServiceHeader({
  service,
  t,
}: {
  service: ServiceRow;
  t: Awaited<ReturnType<typeof getTranslations<"ServiceDetail">>>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
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
    </div>
  );
}
