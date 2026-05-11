import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const FALLBACK_SITE_URL = "http://localhost:3000";

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
  const t = await getTranslations({ locale, namespace: "Metodologia" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function MetodologiaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Metodologia");
  const base = siteUrl();
  const badgeHtml = `<img src="${base}/api/badge/{slug}/v1.svg" alt="Uptime {slug}">`;
  const badgeMd = `![Uptime {slug}](${base}/api/badge/{slug}/v1.svg)`;

  return (
    <div className="mx-auto flex w-full max-w-screen-md flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <section aria-labelledby="metodologia-heading" className="flex flex-col gap-2">
        <h1 id="metodologia-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="text-base text-muted-foreground">{t("tagline")}</p>
      </section>

      {/* Monitoramento */}
      <section aria-labelledby="monitoring-heading" className="flex flex-col gap-4">
        <h2 id="monitoring-heading" className="text-xl font-semibold tracking-tight">
          {t("monitoring.heading")}
        </h2>
        <p className="text-muted-foreground">{t("monitoring.body")}</p>
        <p className="text-muted-foreground">{t("monitoring.failDefinition")}</p>
        <dl className="flex flex-col gap-0 divide-y divide-border rounded-lg border">
          {(
            [
              ["tool", "toolValue"],
              ["frequency", "frequencyValue"],
              ["checkType", "checkTypeValue"],
              ["timeout", "timeoutValue"],
              ["failCriteria", "failCriteriaValue"],
            ] as const
          ).map(([labelKey, valueKey]) => (
            <div key={labelKey} className="flex gap-4 px-4 py-3">
              <dt className="w-40 shrink-0 text-sm font-medium">{t(`monitoring.${labelKey}`)}</dt>
              <dd className="text-sm text-muted-foreground">{t(`monitoring.${valueKey}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cálculo de uptime */}
      <section aria-labelledby="uptime-heading" className="flex flex-col gap-4">
        <h2 id="uptime-heading" className="text-xl font-semibold tracking-tight">
          {t("uptime.heading")}
        </h2>
        <code className="block rounded-lg bg-muted px-4 py-3 font-mono text-sm">
          {t("uptime.formula")}
        </code>
        <p className="text-muted-foreground">{t("uptime.body")}</p>
        <p className="text-sm text-muted-foreground">{t("uptime.windowNote")}</p>
      </section>

      {/* SLA */}
      <section id="sla" aria-labelledby="sla-heading" className="flex flex-col gap-4">
        <h2 id="sla-heading" className="text-xl font-semibold tracking-tight">
          {t("sla.heading")}
        </h2>
        <p className="text-muted-foreground">{t("sla.body")}</p>
        <p className="text-sm text-muted-foreground">{t("sla.compliance")}</p>
      </section>

      {/* Severidade */}
      <section aria-labelledby="severity-heading" className="flex flex-col gap-4">
        <h2 id="severity-heading" className="text-xl font-semibold tracking-tight">
          {t("severity.heading")}
        </h2>
        <p className="text-muted-foreground">{t("severity.body")}</p>
        <dl className="flex flex-col gap-0 divide-y divide-border rounded-lg border">
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-20 shrink-0 text-sm font-medium">{t("severity.partialLabel")}</dt>
            <dd className="text-sm text-muted-foreground">{t("severity.partialDef")}</dd>
          </div>
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-20 shrink-0 text-sm font-medium">{t("severity.totalLabel")}</dt>
            <dd className="text-sm text-muted-foreground">{t("severity.totalDef")}</dd>
          </div>
        </dl>
      </section>

      {/* Badge embed */}
      <section aria-labelledby="badge-heading" className="flex flex-col gap-4">
        <h2 id="badge-heading" className="text-xl font-semibold tracking-tight">
          {t("badge.heading")}
        </h2>
        <p className="text-muted-foreground">{t("badge.body")}</p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("badge.htmlLabel")}</span>
            <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-sm">
              <code>{badgeHtml}</code>
            </pre>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("badge.markdownLabel")}</span>
            <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-sm">
              <code>{badgeMd}</code>
            </pre>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("badge.cacheNote")}</p>
      </section>

      {/* Aviso / disclaimer */}
      <section aria-labelledby="disclaimer-heading" className="flex flex-col gap-3">
        <h2 id="disclaimer-heading" className="text-xl font-semibold tracking-tight">
          {t("disclaimer.heading")}
        </h2>
        <div className="rounded-lg border-l-4 border-degraded bg-degraded/30 px-4 py-3 text-sm text-degraded-foreground">
          {t("disclaimer.body")}
        </div>
      </section>

      {/* Limitações conhecidas */}
      <section aria-labelledby="limitations-heading" className="flex flex-col gap-4">
        <h2 id="limitations-heading" className="text-xl font-semibold tracking-tight">
          {t("limitations.heading")}
        </h2>
        <ul className="flex flex-col gap-2 pl-4">
          {(["item1", "item2", "item3", "item4", "item5"] as const).map((key) => (
            <li key={key} className="list-disc text-sm text-muted-foreground">
              {t(`limitations.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* Links */}
      <section aria-labelledby="links-heading" className="flex flex-col gap-4">
        <h2 id="links-heading" className="text-xl font-semibold tracking-tight">
          {t("links.heading")}
        </h2>
        <ul className="flex flex-col gap-4">
          <li className="flex flex-col gap-0.5">
            <a
              href="https://github.com/ThiagoRech1997/statusbrasil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline underline-offset-4"
            >
              {t("links.repoLabel")}
            </a>
            <span className="text-sm text-muted-foreground">{t("links.repoDesc")}</span>
          </li>
          <li className="flex flex-col gap-0.5">
            <a href="/api/docs" className="text-sm font-medium underline underline-offset-4">
              {t("links.apiLabel")}
            </a>
            <span className="text-sm text-muted-foreground">{t("links.apiDesc")}</span>
          </li>
          <li className="flex flex-col gap-0.5">
            <Link href="/privacidade" className="text-sm font-medium underline underline-offset-4">
              {t("links.privacyLabel")}
            </Link>
            <span className="text-sm text-muted-foreground">{t("links.privacyDesc")}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
