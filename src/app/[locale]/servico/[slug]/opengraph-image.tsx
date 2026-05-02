import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getServiceWithStatusBySlug } from "@/lib/queries/services";
import { getRolling30dSummary } from "@/lib/queries/uptime";
import { buildServiceOgContent, type OgServiceStatus } from "@/lib/seo/service-og";

export const alt = "StatusBrasil — disponibilidade do serviço";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: requested, slug } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "ServiceOgImage" });

  const [service, summary] = await Promise.all([
    getServiceWithStatusBySlug(db, slug),
    getRolling30dSummary(db, slug),
  ]);
  if (!service) {
    return new ImageResponse(
      <NotFoundCard
        brand={t("brand")}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
      />,
      { ...size, headers: { "cache-control": CACHE_HEADER } },
    );
  }

  const status: OgServiceStatus = service.status;
  const content = buildServiceOgContent({
    serviceName: service.name,
    agency: service.agency,
    status,
    uptimePct30d: summary.uptimePct,
  });

  return new ImageResponse(
    <ServiceCard
      brand={t("brand")}
      tagline={t("tagline")}
      statusLabel={t(`status.${status}`)}
      uptimeLabel={t("uptimeLabel")}
      uptimeUnknownLabel={t("uptimeUnknown")}
      content={content}
    />,
    { ...size, headers: { "cache-control": CACHE_HEADER } },
  );
}

function ServiceCard({
  brand,
  tagline,
  statusLabel,
  uptimeLabel,
  uptimeUnknownLabel,
  content,
}: {
  brand: string;
  tagline: string;
  statusLabel: string;
  uptimeLabel: string;
  uptimeUnknownLabel: string;
  content: ReturnType<typeof buildServiceOgContent>;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
        color: "#f8fafc",
        padding: "64px 80px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        <span>🚦</span>
        <span>{brand}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 500,
            color: content.accentHex,
            letterSpacing: "-0.01em",
          }}
        >
          <span
            style={{
              display: "flex",
              width: 16,
              height: 16,
              borderRadius: 9999,
              background: content.accentHex,
            }}
          />
          <span>{statusLabel}</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            color: "#f8fafc",
            maxWidth: 1040,
          }}
        >
          {content.serviceName}
        </div>

        <div style={{ display: "flex", fontSize: 32, color: "#94a3b8" }}>{content.agency}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 20 }}>
          <div style={{ display: "flex", fontSize: 24, color: "#94a3b8" }}>{uptimeLabel}</div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.05em",
              color: content.uptimeText != null ? content.accentHex : "#94a3b8",
            }}
          >
            {content.uptimeText ?? uptimeUnknownLabel}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 22, color: "#94a3b8", maxWidth: 1040 }}>
        {tagline}
      </div>
    </div>
  );
}

function NotFoundCard({
  brand,
  title,
  description,
}: {
  brand: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
        color: "#f8fafc",
        padding: "64px 80px",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        <span>🚦</span>
        <span>{brand}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#f8fafc",
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#94a3b8", maxWidth: 1040 }}>
          {description}
        </div>
      </div>
      <div />
    </div>
  );
}
