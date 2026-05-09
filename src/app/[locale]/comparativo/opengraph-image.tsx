import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getServiceWithStatusBySlug } from "@/lib/queries/services";
import { getBatchRollingUptimeSummary } from "@/lib/queries/uptime";
import { type OgServiceStatus, statusAccentHex } from "@/lib/seo/service-og";

export const alt = "StatusBrasil — comparativo de disponibilidade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";
const MAX_SERVICES = 4;
const MIN_SERVICES = 2;

interface ServiceData {
  slug: string;
  name: string;
  agency: string;
  status: OgServiceStatus;
  uptime30dPct: number | null;
}

export default async function Image({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ services?: string }>;
}) {
  const { locale: requested } = await params;
  const { services: rawServices } = await searchParams;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "ComparativoOgImage" });

  const slugs = rawServices
    ? rawServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_SERVICES)
    : [];

  if (slugs.length < MIN_SERVICES) {
    return new ImageResponse(
      <FallbackCard brand={t("brand")} title={t("title")} tagline={t("tagline")} />,
      { ...size, headers: { "cache-control": CACHE_HEADER } },
    );
  }

  const [serviceDetails, batchSummary] = await Promise.all([
    Promise.all(slugs.map((slug) => getServiceWithStatusBySlug(db, slug))),
    getBatchRollingUptimeSummary(db, slugs),
  ]);

  const services: ServiceData[] = slugs
    .map((slug, i) => {
      const svc = serviceDetails[i];
      if (!svc) return null;
      return {
        slug,
        name: svc.name,
        agency: svc.agency,
        status: svc.status as OgServiceStatus,
        uptime30dPct: batchSummary.get(slug)?.uptime30dPct ?? null,
      };
    })
    .filter((s): s is ServiceData => s != null);

  if (services.length < MIN_SERVICES) {
    return new ImageResponse(
      <FallbackCard brand={t("brand")} title={t("title")} tagline={t("tagline")} />,
      { ...size, headers: { "cache-control": CACHE_HEADER } },
    );
  }

  return new ImageResponse(
    <ComparativoCard
      brand={t("brand")}
      tagline={t("tagline")}
      uptimeLabel={t("uptimeLabel")}
      noDataLabel={t("noData")}
      services={services}
    />,
    { ...size, headers: { "cache-control": CACHE_HEADER } },
  );
}

// ── Layout constants ─────────────────────────────────────────────────────────

const BG = "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)";
const BAR_CONTAINER_HEIGHT = 200;

function barFillPx(uptime30dPct: number | null): number {
  if (uptime30dPct == null) return 0;
  return Math.max(4, Math.round((uptime30dPct / 100) * BAR_CONTAINER_HEIGHT));
}

function nameFontSize(count: number): number {
  if (count <= 2) return 26;
  if (count === 3) return 22;
  return 18;
}

function uptimeFontSize(count: number): number {
  if (count <= 2) return 44;
  if (count === 3) return 38;
  return 32;
}

// ── Components ───────────────────────────────────────────────────────────────

function ComparativoCard({
  brand,
  tagline,
  uptimeLabel,
  noDataLabel,
  services,
}: {
  brand: string;
  tagline: string;
  uptimeLabel: string;
  noDataLabel: string;
  services: ServiceData[];
}) {
  const count = services.length;
  const colGap = count <= 2 ? 28 : 20;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: "#f8fafc",
        padding: "56px 72px",
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        <span>🚦</span>
        <span>{brand}</span>
      </div>

      {/* Service columns */}
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          gap: colGap,
          marginTop: 32,
          marginBottom: 24,
          alignItems: "stretch",
        }}
      >
        {services.map((svc) => (
          <ServiceColumn
            key={svc.slug}
            svc={svc}
            count={count}
            uptimeLabel={uptimeLabel}
            noDataLabel={noDataLabel}
          />
        ))}
      </div>

      {/* Tagline */}
      <div style={{ display: "flex", fontSize: 20, color: "#94a3b8" }}>{tagline}</div>
    </div>
  );
}

function ServiceColumn({
  svc,
  count,
  uptimeLabel,
  noDataLabel,
}: {
  svc: ServiceData;
  count: number;
  uptimeLabel: string;
  noDataLabel: string;
}) {
  const accent = statusAccentHex(svc.status);
  const fillPx = barFillPx(svc.uptime30dPct);
  const hasData = svc.uptime30dPct != null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: 10,
      }}
    >
      {/* Service name + agency */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            display: "flex",
            fontSize: nameFontSize(count),
            fontWeight: 600,
            color: "#f8fafc",
            lineHeight: 1.2,
          }}
        >
          {svc.name}
        </span>
        <span
          style={{
            display: "flex",
            fontSize: 15,
            color: "#94a3b8",
            lineHeight: 1.3,
          }}
        >
          {svc.agency}
        </span>
      </div>

      {/* Bar chart */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: BAR_CONTAINER_HEIGHT,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            height: fillPx,
            background: hasData ? accent : "#334155",
            minHeight: hasData ? 4 : 0,
          }}
        />
      </div>

      {/* Uptime number */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            display: "flex",
            fontSize: uptimeFontSize(count),
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: hasData ? accent : "#64748b",
          }}
        >
          {hasData ? `${svc.uptime30dPct?.toFixed(1)}%` : noDataLabel}
        </span>
        <span style={{ display: "flex", fontSize: 14, color: "#64748b" }}>{uptimeLabel}</span>
      </div>
    </div>
  );
}

function FallbackCard({
  brand,
  title,
  tagline,
}: {
  brand: string;
  title: string;
  tagline: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
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
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "#f8fafc",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 22, color: "#94a3b8" }}>{tagline}</div>
    </div>
  );
}
