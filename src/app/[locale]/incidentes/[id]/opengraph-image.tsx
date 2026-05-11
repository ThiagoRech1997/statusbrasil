import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { getIncident } from "@/lib/queries/incidents";
import { getServiceBySlug } from "@/lib/queries/services";

export const alt = "StatusBrasil — incidente de disponibilidade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

const CLOSED_CACHE = "public, max-age=86400, immutable";
const OPEN_CACHE = "public, max-age=300";

function compactDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: requested, id } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "IncidentOgImage" });

  const incident = await getIncident(db, id);
  if (!incident) {
    return new ImageResponse(
      <NotFoundCard
        brand={t("brand")}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
      />,
      { ...size, headers: { "cache-control": OPEN_CACHE } },
    );
  }

  const service = await getServiceBySlug(db, incident.serviceSlug);
  if (!service) {
    return new ImageResponse(
      <NotFoundCard
        brand={t("brand")}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
      />,
      { ...size, headers: { "cache-control": OPEN_CACHE } },
    );
  }

  const now = new Date();
  const durationSeconds =
    incident.durationSeconds ??
    (incident.endedAt == null
      ? Math.max(0, Math.round((now.getTime() - incident.startedAt.getTime()) / 1000))
      : null);

  const isClosed = incident.endedAt != null;
  const cacheHeader = isClosed ? CLOSED_CACHE : OPEN_CACHE;

  const duration =
    durationSeconds != null && durationSeconds > 0 ? compactDuration(durationSeconds) : null;

  const durationLine =
    duration != null ? t("durationLine", { duration, serviceName: service.name }) : service.name;

  const dateFormatted = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(incident.startedAt);

  const statusLine =
    incident.statusCode != null ? t("httpLabel", { code: incident.statusCode }) : null;

  const ongoingLabel = isClosed ? null : t("ongoingLabel");

  const severityLabel = t(`severity.${incident.severity}`);
  const severityColor = incident.severity === "total" ? "#ef4444" : "#f59e0b";

  return new ImageResponse(
    <IncidentCard
      brand={t("brand")}
      tagline={t("tagline")}
      durationLine={durationLine}
      dateLabel={t("dateLabel", { date: dateFormatted })}
      statusLine={statusLine}
      ongoingLabel={ongoingLabel}
      severityLabel={severityLabel}
      severityColor={severityColor}
    />,
    { ...size, headers: { "cache-control": cacheHeader } },
  );
}

function IncidentCard({
  brand,
  tagline,
  durationLine,
  dateLabel,
  statusLine,
  ongoingLabel,
  severityLabel,
  severityColor,
}: {
  brand: string;
  tagline: string;
  durationLine: string;
  dateLabel: string;
  statusLine: string | null;
  ongoingLabel: string | null;
  severityLabel: string;
  severityColor: string;
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
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            fontWeight: 500,
            color: severityColor,
            letterSpacing: "-0.01em",
          }}
        >
          <span
            style={{
              display: "flex",
              width: 16,
              height: 16,
              borderRadius: 9999,
              background: severityColor,
            }}
          />
          <span>{severityLabel}</span>
          {ongoingLabel && (
            <span style={{ color: "#94a3b8", fontSize: 22, fontWeight: 400 }}>
              — {ongoingLabel}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            color: "#f8fafc",
            maxWidth: 1040,
          }}
        >
          {durationLine}
        </div>

        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 26,
            color: "#94a3b8",
            marginTop: 8,
          }}
        >
          <span>{dateLabel}</span>
          {statusLine && (
            <>
              <span style={{ color: "#475569" }}>•</span>
              <span style={{ fontFamily: "monospace" }}>{statusLine}</span>
            </>
          )}
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
