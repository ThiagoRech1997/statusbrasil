"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useFormatter, useTranslations } from "next-intl";
import { type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LATENCY_WINDOWS, type LatencySample, type LatencyWindow } from "./latency-chart";

export type { LatencySample, LatencyWindow };

// Vibrant, work on both light (#fff) and dark (~#1a1a1a) backgrounds
const SERIES_COLORS = [
  "#3b82f6", // blue-500
  "#f97316", // orange-500
  "#22c55e", // green-500
  "#d946ef", // fuchsia-500
] as const;

export type SeriesColor = (typeof SERIES_COLORS)[number];

export interface MultiLatencyEntry {
  slug: string;
  name: string;
  windows: Record<LatencyWindow, LatencySample[]>;
}

export interface MultiLatencyChartProps {
  services: MultiLatencyEntry[];
  defaultWindow?: LatencyWindow;
  className?: string;
}

const WIDTH = 720;
const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 48 };
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function nearestIndex(samples: LatencySample[], target: number): number {
  if (samples.length === 0) return -1;
  let bestIdx = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s) continue;
    const delta = Math.abs(s.timestamp.getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function MultiLatencyChart({
  services,
  defaultWindow = "7d",
  className,
}: MultiLatencyChartProps) {
  const t = useTranslations("MultiLatencyChart");
  const format = useFormatter();
  const [activeWindow, setActiveWindow] = useState<LatencyWindow>(defaultWindow);
  const [activeTime, setActiveTime] = useState<number | null>(null);
  const overlayRef = useRef<SVGRectElement | null>(null);

  const onWindowChange = (next: LatencyWindow) => {
    setActiveWindow(next);
    setActiveTime(null);
  };

  const activeSamples = services.map((svc) => svc.windows[activeWindow] ?? []);

  const { xScale, yScale } = useMemo(() => {
    const all = activeSamples.flat();
    if (all.length === 0) return { xScale: null, yScale: null };

    const times = all.map((s) => s.timestamp.getTime());
    const xMin = Math.min(...times);
    const xMax = Math.max(...times);

    const yValues: number[] = [];
    for (const s of all) {
      if (s.p50 != null) yValues.push(s.p50);
    }
    const yMax = yValues.length > 0 ? Math.max(...yValues) : 0;

    return {
      xScale: scaleTime<number>({
        domain: [new Date(xMin), new Date(xMax)],
        range: [0, INNER_WIDTH],
      }),
      yScale: scaleLinear<number>({
        domain: [0, yMax > 0 ? yMax * 1.1 : 1],
        range: [INNER_HEIGHT, 0],
        nice: true,
      }),
    };
  }, [activeSamples]);

  const hasData = activeSamples.some((s) => s.length > 0);

  const nearestByService =
    activeTime != null
      ? activeSamples.map((samples) => {
          const idx = nearestIndex(samples, activeTime);
          return idx >= 0 ? (samples[idx] ?? null) : null;
        })
      : services.map(() => null);

  const firstActiveSample = nearestByService.find((s) => s != null) ?? null;
  const cursorX = firstActiveSample && xScale ? xScale(firstActiveSample.timestamp) : null;

  const onPointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!xScale) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = INNER_WIDTH / rect.width;
    const x = (e.clientX - rect.left) * ratio;
    setActiveTime(xScale.invert(x).getTime());
  };

  const onPointerLeave = () => setActiveTime(null);

  const formatTickTimestamp = (d: Date) =>
    activeWindow === "1d"
      ? format.dateTime(d, { hour: "2-digit", minute: "2-digit" })
      : format.dateTime(d, { day: "numeric", month: "short" });

  const formatTooltipTimestamp = (d: Date) =>
    format.dateTime(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const axisTickProps = {
    fill: "currentColor" as const,
    fontSize: 10,
    fontFamily: "inherit",
  };

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="multi-latency-chart">
      <fieldset className="inline-flex w-fit rounded-lg border border-border bg-card p-0.5 text-xs">
        <legend className="sr-only">{t("windowGroupLabel")}</legend>
        {LATENCY_WINDOWS.map((w) => {
          const isActive = w === activeWindow;
          return (
            <button
              key={w}
              type="button"
              aria-pressed={isActive}
              aria-label={t(`windowAria.${w}`)}
              onClick={() => onWindowChange(w)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`window.${w}`)}
            </button>
          );
        })}
      </fieldset>

      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <div className="relative inline-block" style={{ width: WIDTH }}>
          <svg
            aria-label={t("ariaLabel")}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width={WIDTH}
            height={HEIGHT}
            className="block text-foreground"
          >
            {!hasData || !xScale || !yScale ? (
              <text
                x={WIDTH / 2}
                y={HEIGHT / 2}
                textAnchor="middle"
                className="fill-muted-foreground text-sm"
              >
                {t("empty")}
              </text>
            ) : (
              <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
                <AxisLeft
                  scale={yScale}
                  numTicks={4}
                  stroke="currentColor"
                  tickStroke="currentColor"
                  hideAxisLine
                  tickLabelProps={() => ({
                    ...axisTickProps,
                    textAnchor: "end" as const,
                    dx: -4,
                    dy: 3,
                  })}
                  tickFormat={(v) => format.number(Number(v))}
                />
                <AxisBottom
                  top={INNER_HEIGHT}
                  scale={xScale}
                  numTicks={5}
                  stroke="currentColor"
                  tickStroke="currentColor"
                  tickLabelProps={() => ({
                    ...axisTickProps,
                    textAnchor: "middle" as const,
                    dy: 4,
                  })}
                  tickFormat={(v) => formatTickTimestamp(v as Date)}
                />

                {activeSamples.map((samples, idx) => {
                  const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
                  const svc = services[idx];
                  return (
                    <LinePath<LatencySample>
                      key={svc?.slug ?? idx}
                      data={samples}
                      defined={(d) => d.p50 != null}
                      x={(d) => xScale(d.timestamp)}
                      y={(d) => yScale(d.p50 ?? 0)}
                      stroke={color}
                      strokeWidth={1.75}
                      fill="none"
                    />
                  );
                })}

                {cursorX != null && (
                  <g pointerEvents="none">
                    <line
                      x1={cursorX}
                      x2={cursorX}
                      y1={0}
                      y2={INNER_HEIGHT}
                      stroke="currentColor"
                      strokeDasharray="2 2"
                      strokeWidth={1}
                      className="text-muted-foreground"
                    />
                    {nearestByService.map((sample, idx) => {
                      if (!sample || sample.p50 == null) return null;
                      const cy = yScale(sample.p50);
                      const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
                      return (
                        <circle
                          key={services[idx]?.slug ?? idx}
                          cx={cursorX}
                          cy={cy}
                          r={3.5}
                          fill={color}
                          className="stroke-background"
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </g>
                )}

                <rect
                  ref={overlayRef}
                  x={0}
                  y={0}
                  width={INNER_WIDTH}
                  height={INNER_HEIGHT}
                  fill="transparent"
                  className="cursor-crosshair"
                  onPointerMove={onPointerMove}
                  onPointerLeave={onPointerLeave}
                />
              </g>
            )}
          </svg>

          {cursorX != null && firstActiveSample != null && (
            <div
              role="tooltip"
              style={{
                left: cursorX + MARGIN.left,
                top: 8,
                transform:
                  (cursorX + MARGIN.left) / WIDTH > 0.7
                    ? "translateX(calc(-100% - 8px))"
                    : "translateX(8px)",
              }}
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
            >
              <div className="mb-1 font-medium">
                {formatTooltipTimestamp(firstActiveSample.timestamp)}
              </div>
              {nearestByService.map((sample, idx) => {
                const svc = services[idx];
                if (!svc || !sample) return null;
                const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
                const ms = sample.p50 == null ? "—" : `${format.number(Math.round(sample.p50))} ms`;
                return (
                  <div key={svc.slug} className="flex items-center gap-2">
                    <span
                      className="inline-block h-0.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{svc.name}:</span>
                    <span className="tabular-nums font-medium">{ms}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        data-slot="multi-latency-legend"
        className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
      >
        {services.map((svc, idx) => {
          const color = SERIES_COLORS[idx] ?? SERIES_COLORS[0];
          return (
            <span key={svc.slug} className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-0.5 w-5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-foreground">{svc.name}</span>
            </span>
          );
        })}
        <span className="ml-auto" aria-hidden>
          {t("axisYLabel")}
        </span>
      </div>
    </div>
  );
}
