import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PrivacidadePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Privacy");
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  const UA = "StatusBrasil/1.0 (+https://statusbrasil.org/sobre)";

  return (
    <div className="mx-auto flex w-full max-w-screen-md flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <section aria-labelledby="privacy-heading" className="flex flex-col gap-2">
        <h1 id="privacy-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("intro")}</p>
      </section>

      <dl className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <dt className="text-base font-semibold">{t("noCookies.heading")}</dt>
          <dd className="text-muted-foreground">{t("noCookies.body")}</dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-base font-semibold">{t("noPersonalData.heading")}</dt>
          <dd className="text-muted-foreground">{t("noPersonalData.body")}</dd>
        </div>

        {plausibleDomain && (
          <div className="flex flex-col gap-1">
            <dt className="text-base font-semibold">{t("analytics.heading")}</dt>
            <dd className="text-muted-foreground">{t("analytics.body")}</dd>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <dt className="text-base font-semibold">{t("noGA.heading")}</dt>
          <dd className="text-muted-foreground">{t("noGA.body")}</dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-base font-semibold">{t("userAgent.heading")}</dt>
          <dd className="text-muted-foreground">
            <p>{t("userAgent.body")}</p>
            <code className="mt-2 block rounded-md bg-muted px-3 py-2 font-mono text-sm">{UA}</code>
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-base font-semibold">{t("publicEndpoints.heading")}</dt>
          <dd className="text-muted-foreground">{t("publicEndpoints.body")}</dd>
        </div>
      </dl>
    </div>
  );
}
