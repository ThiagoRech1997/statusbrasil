"use client";

import { scaleBand } from "@visx/scale";
import { useFormatter, useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type UptimeBucket = "operational" | "degraded" | "down" | "unknown";

export interface UptimeBarPoint {
  date: Date;
  uptimePct: number | null;
  incidentCount: number;
}

export interface UptimeBarsProps {
  data: UptimeBarPoint[];
  serviceName: string;
  className?: string;
}

const BAR_WIDTH = 6;
const BAR_GAP = 2;
const HEIGHT = 36;

const BAR_FILL: Record<UptimeBucket, string> = {
  operational: "fill-operational",
  degraded: "fill-degraded",
  down: "fill-down",
  unknown: "fill-muted",
};

export function bucketUptime(uptimePct: number | null): UptimeBucket {
  if (uptimePct == null) return "unknown";
  if (uptimePct >= 99) return "operational";
  if (uptimePct >= 95) return "degraded";
  return "down";
}

export function UptimeBars({ data, serviceName, className }: UptimeBarsProps) {
  const t = useTranslations("UptimeBars");
  const format = useFormatter();
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const tableId = useId();

  const innerWidth = data.length * (BAR_WIDTH + BAR_GAP);

  const xScale = useMemo(
    () =>
      scaleBand<number>({
        domain: data.map((_, i) => i),
        range: [0, innerWidth],
        paddingInner: BAR_GAP / (BAR_WIDTH + BAR_GAP),
      }),
    [data, innerWidth],
  );

  if (data.length === 0) {
    return (
      <p data-slot="uptime-bars-empty" className={cn("text-sm text-muted-foreground", className)}>
        {t("empty")}
      </p>
    );
  }

  const formatDate = (d: Date) => format.dateTime(d, { day: "numeric", month: "long" });
  const formatPct = (pct: number) =>
    format.number(pct / 100, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

  const ariaLabelFor = (p: UptimeBarPoint) => {
    const date = formatDate(p.date);
    if (p.uptimePct == null) return t("ariaBarUnknown", { date });
    return t("ariaBar", {
      date,
      uptime: formatPct(p.uptimePct),
      count: p.incidentCount,
    });
  };

  const focusBar = (idx: number) => {
    barRefs.current[idx]?.focus();
    setActiveIndex(idx);
  };

  const onKeyDown = (e: KeyboardEvent<SVGRectElement>, idx: number) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        focusBar(Math.max(0, idx - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        focusBar(Math.min(data.length - 1, idx + 1));
        break;
      case "Home":
        e.preventDefault();
        focusBar(0);
        break;
      case "End":
        e.preventDefault();
        focusBar(data.length - 1);
        break;
      default:
        break;
    }
  };

  const rovingIndex = activeIndex ?? 0;
  const active = activeIndex != null ? data[activeIndex] : null;
  const activeX = activeIndex != null ? (xScale(activeIndex) ?? 0) : 0;
  const activeBucket = active ? bucketUptime(active.uptimePct) : "unknown";

  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="uptime-bars">
      <div className="snap-x snap-proximity overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <div className="relative inline-block" style={{ minWidth: innerWidth }}>
          {/* biome-ignore lint/a11y/useSemanticElements: SVG cannot be replaced with <fieldset>; role="group" is required so interactive <rect role="button"> descendants are valid ARIA. */}
          <svg
            role="group"
            aria-label={t("ariaLabel", { service: serviceName, count: data.length })}
            aria-describedby={tableId}
            width={innerWidth}
            height={HEIGHT}
            viewBox={`0 0 ${innerWidth} ${HEIGHT}`}
            className="block"
          >
            {data.map((point, i) => {
              const bucket = bucketUptime(point.uptimePct);
              const x = xScale(i) ?? 0;
              const isActive = activeIndex === i;
              return (
                // biome-ignore lint/a11y/useSemanticElements: SVG <rect> can't be a real <button>; role="button" + roving tabindex is the documented pattern for keyboard-navigable chart items.
                <rect
                  key={point.date.toISOString()}
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  x={x}
                  y={0}
                  width={BAR_WIDTH}
                  height={HEIGHT}
                  rx={1}
                  role="button"
                  tabIndex={i === rovingIndex ? 0 : -1}
                  aria-label={ariaLabelFor(point)}
                  data-bucket={bucket}
                  data-index={i}
                  data-active={isActive ? "true" : undefined}
                  className={cn(
                    BAR_FILL[bucket],
                    "snap-start cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
                    activeIndex == null
                      ? "opacity-100 hover:opacity-80"
                      : isActive
                        ? "opacity-100"
                        : "opacity-50",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(i)}
                  onBlur={() => setActiveIndex(null)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
              );
            })}
          </svg>
          {active ? (
            <div
              role="tooltip"
              data-slot="uptime-bars-tooltip"
              data-bucket={activeBucket}
              style={{
                left: activeX + BAR_WIDTH / 2,
                top: HEIGHT + 6,
              }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
            >
              <div className="font-medium">{formatDate(active.date)}</div>
              <div className="tabular-nums">
                {active.uptimePct == null
                  ? t("tooltipUptimeUnknown")
                  : t("tooltipUptime", { value: formatPct(active.uptimePct) })}
              </div>
              <div className="text-muted-foreground">
                {t("tooltipIncidents", { count: active.incidentCount })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <table
        id={tableId}
        className="sr-only"
        data-slot="uptime-bars-table"
        aria-label={t("tableCaption")}
      >
        <thead>
          <tr>
            <th>{t("tableHeaderDate")}</th>
            <th>{t("tableHeaderUptime")}</th>
            <th>{t("tableHeaderIncidents")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date.toISOString()}>
              <td>{formatDate(point.date)}</td>
              <td>{point.uptimePct == null ? t("tableUnknown") : formatPct(point.uptimePct)}</td>
              <td>{point.incidentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
