import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getWorstServicesByUptime30d, type WorstServiceUptime } from "@/lib/queries/services";

export const alt = "StatusBrasil — ranking dos piores serviços por uptime";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CACHE_HEADER = "public, max-age=3600, stale-while-revalidate=86400";

function accentForUptime(pct: number): string {
  if (pct < 50) return "#f87171";
  if (pct < 99) return "#fb923c";
  return "#4ade80";
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "RankingOgImage" });

  const worst = await getWorstServicesByUptime30d(db, 3);

  return new ImageResponse(
    <RankingCard
      brand={t("brand")}
      title={t("title")}
      tagline={t("tagline")}
      uptimeLabel={t("uptimeLabel")}
      emptyLabel={t("emptyLabel")}
      services={worst}
    />,
    { ...size, headers: { "cache-control": CACHE_HEADER } },
  );
}

function RankingCard({
  brand,
  title,
  tagline,
  uptimeLabel,
  emptyLabel,
  services,
}: {
  brand: string;
  title: string;
  tagline: string;
  uptimeLabel: string;
  emptyLabel: string;
  services: WorstServiceUptime[];
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

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#f8fafc",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {services.length === 0 ? (
            <span style={{ display: "flex", fontSize: 32, color: "#94a3b8" }}>{emptyLabel}</span>
          ) : (
            services.map((svc, i) => (
              <ServiceRow
                key={svc.slug}
                rank={i + 1}
                name={svc.name}
                agency={svc.agency}
                uptimePct={svc.uptime30dPct}
                uptimeLabel={uptimeLabel}
              />
            ))
          )}
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 22, color: "#94a3b8" }}>{tagline}</div>
    </div>
  );
}

function ServiceRow({
  rank,
  name,
  agency,
  uptimePct,
  uptimeLabel,
}: {
  rank: number;
  name: string;
  agency: string;
  uptimePct: number;
  uptimeLabel: string;
}) {
  const accent = accentForUptime(uptimePct);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 12,
        padding: "16px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: "#475569",
            width: 28,
            flexShrink: 0,
          }}
        >
          #{rank}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: "#f8fafc",
              maxWidth: 700,
            }}
          >
            {name}
          </span>
          <span style={{ display: "flex", fontSize: 20, color: "#94a3b8" }}>{agency}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            color: accent,
          }}
        >
          {uptimePct.toFixed(1)}%
        </span>
        <span style={{ display: "flex", fontSize: 16, color: "#64748b" }}>{uptimeLabel}</span>
      </div>
    </div>
  );
}
