import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { formatDowntimeDuration } from "@/lib/editorial/downtime";
import { getHomeDashboard } from "@/lib/queries/services";
import { getCumulativeDowntime24h } from "@/lib/queries/uptime";

export const alt = "StatusBrasil — disponibilidade dos serviços do governo brasileiro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CACHE_HEADER = "public, s-maxage=86400, immutable";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "OgImage" });

  const [groups, downtimeBySlug] = await Promise.all([
    getHomeDashboard(db),
    getCumulativeDowntime24h(db),
  ]);

  const downCount = groups.flatMap((g) => g.services).filter((s) => s.status === "down").length;

  const totalDowntimeSeconds = Object.values(downtimeBySlug).reduce(
    (sum, s) => sum + Math.max(0, s),
    0,
  );

  const downtimeLine =
    totalDowntimeSeconds > 0
      ? t("downtimeWithTotal", {
          duration: formatDowntimeDuration(locale, totalDowntimeSeconds),
        })
      : t("downtimeNone");

  const accent = downCount > 0 ? "#f87171" : "#4ade80";

  return new ImageResponse(
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
        <span>{t("brand")}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <span
            style={{
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.06em",
              color: accent,
            }}
          >
            {downCount}
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 500,
              color: "#e2e8f0",
              lineHeight: 1.15,
              maxWidth: 620,
            }}
          >
            {t("downLabel", { count: downCount })}
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#94a3b8" }}>{downtimeLine}</div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: "#94a3b8",
          maxWidth: 1040,
        }}
      >
        {t("tagline")}
      </div>
    </div>,
    {
      ...size,
      headers: { "cache-control": CACHE_HEADER },
    },
  );
}
