import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeaturedComparativos } from "@/components/comparativo/featured-comparativos";
import { routing } from "@/i18n/routing";

export const revalidate = 60;

const FALLBACK_SITE_URL = "http://localhost:3000";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ services?: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const { services: rawServices } = await searchParams;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const t = await getTranslations({ locale, namespace: "Comparativo" });
  const url = siteUrl();
  const canonical = `${url}/${locale}/comparativo`;

  const ogImageUrl =
    rawServices && rawServices.trim().length > 0
      ? `${url}/${locale}/comparativo/opengraph-image?services=${encodeURIComponent(rawServices)}`
      : `${url}/${locale}/comparativo/opengraph-image`;

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
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [ogImageUrl],
    },
  };
}

export default async function ComparativoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Comparativo");

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

      <FeaturedComparativos />
    </div>
  );
}
