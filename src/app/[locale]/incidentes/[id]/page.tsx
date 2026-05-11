import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { formatDowntimeDuration } from "@/lib/editorial/downtime";
import { getIncident } from "@/lib/queries/incidents";
import { getServiceBySlug } from "@/lib/queries/services";
import { serializeJsonLd } from "@/lib/seo/home-jsonld";
import { buildIncidentJsonLd } from "@/lib/seo/incident-jsonld";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const FALLBACK_SITE_URL = "http://localhost:3000";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "");
}

const loadIncident = cache((id: string) => getIncident(db, id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: requested, id } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const incident = await loadIncident(id);
  if (!incident) notFound();

  const service = await getServiceBySlug(db, incident.serviceSlug);
  if (!service) notFound();

  const t = await getTranslations({ locale, namespace: "IncidentDetail" });
  const format = await getFormatter({ locale });

  const startedAtStr = format.dateTime(incident.startedAt, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const url = siteUrl();
  const canonical = `${url}/${locale}/incidentes/${id}`;
  const severityLabel = t(`severity.${incident.severity}`);
  const title = t("metaTitle", { serviceName: service.name });
  const description = t("metaDescription", {
    severity: severityLabel,
    serviceName: service.name,
    startedAt: startedAtStr,
  });

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${url}/${l}/incidentes/${id}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      locale,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const incident = await loadIncident(id);
  if (!incident) notFound();

  const service = await getServiceBySlug(db, incident.serviceSlug);
  if (!service) notFound();

  const [t, tCategories, format] = await Promise.all([
    getTranslations("IncidentDetail"),
    getTranslations("Categories"),
    getFormatter(),
  ]);

  const now = new Date();
  const durationSeconds =
    incident.durationSeconds ??
    (incident.endedAt == null
      ? Math.max(0, Math.round((now.getTime() - incident.startedAt.getTime()) / 1000))
      : null);

  const formatDateTime = (d: Date) =>
    format.dateTime(d, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

  const categoryLabel = tCategories.has(service.category as never)
    ? tCategories(service.category as never)
    : service.category;

  const severityLabel = t(`severity.${incident.severity}`);

  const eventName = t("jsonLdEventName", { serviceName: service.name });
  const metaDescription = t("metaDescription", {
    severity: severityLabel,
    serviceName: service.name,
    startedAt: formatDateTime(incident.startedAt),
  });

  const jsonLd = serializeJsonLd(
    buildIncidentJsonLd({
      siteUrl: siteUrl(),
      locale,
      incidentId: id,
      eventName,
      description: metaDescription,
      service: {
        slug: service.slug,
        name: service.name,
        agency: service.agency,
        url: service.url,
      },
      startedAt: incident.startedAt,
      endedAt: incident.endedAt,
    }),
  );

  const isClosed = incident.endedAt != null;
  const severityColor = incident.severity === "total" ? "down" : "degraded";

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined; serializeJsonLd escapes `<` to keep the tag safe.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <nav aria-label="Breadcrumb">
          <Link
            href="/incidentes"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring underline-offset-4"
          >
            {t("backToList")}
          </Link>
        </nav>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h1>
            <SeverityBadge label={severityLabel} color={severityColor} />
          </div>
          <p className="font-mono text-xs text-muted-foreground break-all">{id}</p>
        </header>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          <DetailRow label={t("labels.service")}>
            <Link
              href={`/servico/${service.slug}`}
              className="font-medium hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring underline-offset-4"
            >
              {service.name}
            </Link>
          </DetailRow>

          <DetailRow label={t("labels.category")}>{categoryLabel}</DetailRow>

          <DetailRow label={t("labels.severity")}>
            <SeverityBadge label={severityLabel} color={severityColor} />
          </DetailRow>

          <DetailRow label={t("labels.startedAt")}>
            <time dateTime={incident.startedAt.toISOString()} className="tabular-nums">
              {formatDateTime(incident.startedAt)}
            </time>
          </DetailRow>

          <DetailRow label={t("labels.endedAt")}>
            {isClosed && incident.endedAt ? (
              <time dateTime={incident.endedAt.toISOString()} className="tabular-nums">
                {formatDateTime(incident.endedAt)}
              </time>
            ) : (
              <span className="text-muted-foreground">{t("ongoing")}</span>
            )}
          </DetailRow>

          <DetailRow label={t("labels.duration")}>
            {durationSeconds != null && durationSeconds > 0 ? (
              <span className="tabular-nums">
                {formatDowntimeDuration(locale, durationSeconds)}
                {!isClosed ? ` (${t("ongoing")})` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("missing")}</span>
            )}
          </DetailRow>

          <DetailRow label={t("labels.statusCode")}>
            {incident.statusCode != null ? (
              <span className="tabular-nums font-mono">{incident.statusCode}</span>
            ) : (
              <span className="text-muted-foreground">{t("missing")}</span>
            )}
          </DetailRow>

          <DetailRow label={t("labels.errorMessage")} wide>
            {incident.errorMessage ? (
              <span className="whitespace-pre-wrap text-muted-foreground">
                {incident.errorMessage}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("missing")}</span>
            )}
          </DetailRow>
        </dl>
      </div>
    </>
  );
}

function DetailRow({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

function SeverityBadge({ label, color }: { label: string; color: "down" | "degraded" }) {
  return (
    <span
      data-slot="severity-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        color === "down" ? "bg-down text-down-foreground" : "bg-degraded text-degraded-foreground",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
