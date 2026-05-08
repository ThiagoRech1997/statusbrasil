import { getLocale, getTranslations } from "next-intl/server";
import { formatDowntimeDuration } from "@/lib/editorial/downtime";
import type { CurrentStatus } from "@/lib/queries/services";

export interface ServiceStatsRow {
  slug: string;
  name: string;
  agency: string;
  status: CurrentStatus;
  uptime30dPct: number | null;
  mttr30dSeconds: number | null;
  incidents30d: number;
  currentMonthUptimePct: number | null;
}

export interface ComparativoStatsGridProps {
  services: ServiceStatsRow[];
}

const STATUS_BADGE: Record<CurrentStatus, string> = {
  operational: "bg-operational text-operational-foreground",
  degraded: "bg-degraded text-degraded-foreground",
  down: "bg-down text-down-foreground",
  unknown: "bg-muted text-muted-foreground",
};

// Mirror the palette from the chart components
const SERIES_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#d946ef"] as const;

function formatPct(pct: number | null, noData: string): string {
  if (pct === null) return noData;
  return `${pct.toFixed(2)}%`;
}

export async function ComparativoStatsGrid({ services }: ComparativoStatsGridProps) {
  const t = await getTranslations("Comparativo");
  const locale = await getLocale();

  const colCount = services.length;
  const gridStyle = {
    gridTemplateColumns: `auto repeat(${colCount}, 1fr)`,
  } as React.CSSProperties;

  const noData = t("stats.noData");

  const rows: { label: string; render: (svc: ServiceStatsRow) => React.ReactNode }[] = [
    {
      label: t("stats.status"),
      render: (svc) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[svc.status]}`}
        >
          {t(`stats.status.${svc.status}`)}
        </span>
      ),
    },
    {
      label: t("stats.uptime30d"),
      render: (svc) => (
        <span className="tabular-nums">{formatPct(svc.uptime30dPct, noData)}</span>
      ),
    },
    {
      label: t("stats.currentMonthUptime"),
      render: (svc) => (
        <span className="tabular-nums">{formatPct(svc.currentMonthUptimePct, noData)}</span>
      ),
    },
    {
      label: t("stats.mttr30d"),
      render: (svc) => (
        <span className="tabular-nums">
          {svc.mttr30dSeconds != null
            ? formatDowntimeDuration(locale, svc.mttr30dSeconds) || noData
            : noData}
        </span>
      ),
    },
    {
      label: t("stats.incidents30d"),
      render: (svc) => <span className="tabular-nums">{svc.incidents30d}</span>,
    },
  ];

  return (
    <div
      data-slot="comparativo-stats-grid"
      className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
    >
      {/* Mobile: one card per service */}
      <div className="grid gap-4 sm:hidden">
        {services.map((svc, idx) => {
          const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
          return (
            <div key={svc.slug} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <div className="font-medium leading-snug">{svc.name}</div>
                  <div className="text-xs text-muted-foreground">{svc.agency}</div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd>{row.render(svc)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Desktop: side-by-side grid */}
      <div
        className="hidden min-w-max sm:grid"
        style={gridStyle}
        role="table"
        aria-label={t("statsHeading")}
      >
        {/* Header row */}
        <div role="row" className="contents">
          <div role="columnheader" className="p-3" />
          {services.map((svc, idx) => {
            const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
            return (
              <div
                key={svc.slug}
                role="columnheader"
                className="border-b border-border p-3 pb-4"
              >
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1 inline-block size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <div className="font-medium leading-snug">{svc.name}</div>
                    <div className="text-xs text-muted-foreground">{svc.agency}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Metric rows */}
        {rows.map((row, rowIdx) => (
          <div key={row.label} role="row" className="contents">
            <div
              role="rowheader"
              className={`flex items-center py-3 pr-6 text-sm text-muted-foreground ${rowIdx > 0 ? "border-t border-border" : ""}`}
            >
              {row.label}
            </div>
            {services.map((svc) => (
              <div
                key={svc.slug}
                role="cell"
                className={`flex items-center p-3 text-sm ${rowIdx > 0 ? "border-t border-border" : ""}`}
              >
                {row.render(svc)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
