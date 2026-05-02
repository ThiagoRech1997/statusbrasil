"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useFormatter, useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export const LATENCY_WINDOWS = ["1d", "7d", "30d", "90d"] as const;
export type LatencyWindow = (typeof LATENCY_WINDOWS)[number];

export interface LatencySample {
  timestamp: Date;
  p50: number | null;
  p95: number | null;
}

export interface LatencyChartProps {
  windows: Record<LatencyWindow, LatencySample[]>;
  defaultWindow?: LatencyWindow;
  serviceName: string;
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
    const sample = samples[i];
    if (!sample) continue;
    const delta = Math.abs(sample.timestamp.getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function LatencyChart({
  windows,
  defaultWindow = "7d",
  serviceName,
  className,
}: LatencyChartProps) {
  const t = useTranslations("LatencyChart");
  const format = useFormatter();
  const [activeWindow, setActiveWindow] = useState<LatencyWindow>(defaultWindow);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const overlayRef = useRef<SVGRectElement | null>(null);
  const captionId = useId();
  const tableId = useId();
  const instructionsId = useId();

  const samples = windows[activeWindow] ?? [];

  const onWindowChange = (next: LatencyWindow) => {
    setActiveWindow(next);
    setActiveIndex(null);
  };

  const { xScale, yScale } = useMemo(() => {
    if (samples.length === 0) {
      return { xScale: null, yScale: null };
    }
    const times = samples.map((s) => s.timestamp.getTime());
    const xMin = Math.min(...times);
    const xMaxTime = Math.max(...times);
    const yValues: number[] = [];
    for (const s of samples) {
      if (s.p50 != null) yValues.push(s.p50);
      if (s.p95 != null) yValues.push(s.p95);
    }
    const localYMax = yValues.length > 0 ? Math.max(...yValues) : 0;
    return {
      xScale: scaleTime<number>({
        domain: [new Date(xMin), new Date(xMaxTime)],
        range: [0, INNER_WIDTH],
      }),
      yScale: scaleLinear<number>({
        domain: [0, localYMax > 0 ? localYMax * 1.1 : 1],
        range: [INNER_HEIGHT, 0],
        nice: true,
      }),
    };
  }, [samples]);

  const formatTickTimestamp = (d: Date) =>
    activeWindow === "1d"
      ? format.dateTime(d, { hour: "2-digit", minute: "2-digit" })
      : format.dateTime(d, { day: "numeric", month: "short" });

  const formatTooltipTimestamp = (d: Date) =>
    format.dateTime(d, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMs = (ms: number | null) =>
    ms == null ? t("tooltipNoData") : t("valueMs", { value: format.number(Math.round(ms)) });

  const onPointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!xScale || samples.length === 0) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = INNER_WIDTH / rect.width;
    const x = (e.clientX - rect.left) * ratio;
    const time = xScale.invert(x).getTime();
    setActiveIndex(nearestIndex(samples, time));
  };

  const onPointerLeave = () => setActiveIndex(null);

  const onFocus = () => {
    if (samples.length === 0) return;
    setActiveIndex((idx) => idx ?? samples.length - 1);
  };

  const onBlur = () => setActiveIndex(null);

  const onKeyDown = (e: KeyboardEvent<SVGRectElement>) => {
    if (samples.length === 0) return;
    const idx = activeIndex ?? samples.length - 1;
    let next = idx;
    switch (e.key) {
      case "ArrowLeft":
        next = Math.max(0, idx - 1);
        break;
      case "ArrowRight":
        next = Math.min(samples.length - 1, idx + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = samples.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setActiveIndex(next);
  };

  const active = activeIndex != null ? (samples[activeIndex] ?? null) : null;
  const activeX = active && xScale ? xScale(active.timestamp) : 0;
  const activeP50Y = active && yScale && active.p50 != null ? yScale(active.p50) : null;
  const activeP95Y = active && yScale && active.p95 != null ? yScale(active.p95) : null;

  const axisTickLabelProps = {
    fill: "currentColor",
    fontSize: 10,
    fontFamily: "inherit",
  };

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="latency-chart">
      <WindowToggle activeWindow={activeWindow} onChange={onWindowChange} />
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        <div className="relative inline-block" style={{ width: WIDTH }}>
          <svg
            role="img"
            aria-labelledby={captionId}
            aria-describedby={`${tableId} ${instructionsId}`}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width={WIDTH}
            height={HEIGHT}
            className="block text-foreground"
          >
            <title id={captionId}>
              {t("ariaLabel", {
                service: serviceName,
                window: t(`windowAria.${activeWindow}`),
              })}
            </title>
            {samples.length === 0 || !xScale || !yScale ? (
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
                    ...axisTickLabelProps,
                    textAnchor: "end",
                    dx: -4,
                    dy: 3,
                  })}
                  tickFormat={(value) => format.number(Number(value))}
                />
                <AxisBottom
                  top={INNER_HEIGHT}
                  scale={xScale}
                  numTicks={5}
                  stroke="currentColor"
                  tickStroke="currentColor"
                  tickLabelProps={() => ({
                    ...axisTickLabelProps,
                    textAnchor: "middle",
                    dy: 4,
                  })}
                  tickFormat={(value) => formatTickTimestamp(value as Date)}
                />
                <LinePath<LatencySample>
                  data={samples}
                  defined={(d) => d.p50 != null}
                  x={(d) => xScale(d.timestamp)}
                  y={(d) => yScale(d.p50 ?? 0)}
                  stroke="currentColor"
                  strokeWidth={1.75}
                  fill="none"
                  className="text-foreground"
                  data-line-series="p50"
                />
                <LinePath<LatencySample>
                  data={samples}
                  defined={(d) => d.p95 != null}
                  x={(d) => xScale(d.timestamp)}
                  y={(d) => yScale(d.p95 ?? 0)}
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeDasharray="4 3"
                  fill="none"
                  className="text-muted-foreground"
                  data-line-series="p95"
                />
                {active ? (
                  <g
                    data-slot="latency-chart-marker"
                    pointerEvents="none"
                    className="text-muted-foreground"
                  >
                    <line
                      x1={activeX}
                      x2={activeX}
                      y1={0}
                      y2={INNER_HEIGHT}
                      stroke="currentColor"
                      strokeDasharray="2 2"
                      strokeWidth={1}
                    />
                    {activeP50Y != null ? (
                      <circle
                        cx={activeX}
                        cy={activeP50Y}
                        r={3.5}
                        className="fill-foreground stroke-background"
                        strokeWidth={1.5}
                        data-marker-series="p50"
                      />
                    ) : null}
                    {activeP95Y != null ? (
                      <circle
                        cx={activeX}
                        cy={activeP95Y}
                        r={3.5}
                        className="fill-muted-foreground stroke-background"
                        strokeWidth={1.5}
                        data-marker-series="p95"
                      />
                    ) : null}
                  </g>
                ) : null}
                {/* biome-ignore lint/a11y/useSemanticElements: SVG <rect> can't be a real <button>; role="button" + aria-label is the documented pattern for keyboard-navigable chart overlays. */}
                <rect
                  ref={overlayRef}
                  x={0}
                  y={0}
                  width={INNER_WIDTH}
                  height={INNER_HEIGHT}
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-label={t("instructions")}
                  className="cursor-crosshair outline-none focus-visible:stroke-ring"
                  onPointerMove={onPointerMove}
                  onPointerLeave={onPointerLeave}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  onKeyDown={onKeyDown}
                />
              </g>
            )}
          </svg>
          {active ? (
            <div
              role="tooltip"
              data-slot="latency-chart-tooltip"
              style={{
                left: activeX + MARGIN.left,
                top: 8,
                transform:
                  (activeX + MARGIN.left) / WIDTH > 0.7
                    ? "translateX(calc(-100% - 8px))"
                    : "translateX(8px)",
              }}
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
            >
              <div className="font-medium">{formatTooltipTimestamp(active.timestamp)}</div>
              <div className="tabular-nums" data-tooltip-series="p50">
                {t("tooltipP50", { value: formatMs(active.p50) })}
              </div>
              <div className="tabular-nums text-muted-foreground" data-tooltip-series="p95">
                {t("tooltipP95", { value: formatMs(active.p95) })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <Legend p50Label={t("legendP50")} p95Label={t("legendP95")} yAxisLabel={t("axisYLabel")} />
      <p id={instructionsId} className="sr-only">
        {t("instructions")}
      </p>
      <table
        id={tableId}
        className="sr-only"
        data-slot="latency-chart-table"
        aria-label={t("tableCaption")}
      >
        <thead>
          <tr>
            <th>{t("tableHeaderTimestamp")}</th>
            <th>{t("tableHeaderP50")}</th>
            <th>{t("tableHeaderP95")}</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((sample) => (
            <tr key={sample.timestamp.toISOString()}>
              <td>{formatTooltipTimestamp(sample.timestamp)}</td>
              <td>{sample.p50 == null ? t("tableUnknown") : Math.round(sample.p50)}</td>
              <td>{sample.p95 == null ? t("tableUnknown") : Math.round(sample.p95)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WindowToggle({
  activeWindow,
  onChange,
}: {
  activeWindow: LatencyWindow;
  onChange: (next: LatencyWindow) => void;
}) {
  const t = useTranslations("LatencyChart");
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> is for form controls; for a button-toggle group, role="group" with aria-label is the WAI-ARIA pattern.
    <div
      role="group"
      aria-label={t("windowGroupLabel")}
      data-slot="latency-window-toggle"
      className="inline-flex w-fit rounded-lg border border-border bg-card p-0.5 text-xs"
    >
      {LATENCY_WINDOWS.map((w) => {
        const isActive = w === activeWindow;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={isActive}
            aria-label={t(`windowAria.${w}`)}
            data-window={w}
            data-active={isActive ? "true" : undefined}
            onClick={() => onChange(w)}
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
    </div>
  );
}

function Legend({
  p50Label,
  p95Label,
  yAxisLabel,
}: {
  p50Label: string;
  p95Label: string;
  yAxisLabel: string;
}) {
  return (
    <div
      data-slot="latency-chart-legend"
      className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-5 bg-foreground" />
        <span className="text-foreground">{p50Label}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="h-0.5 w-5 bg-[repeating-linear-gradient(90deg,currentColor,currentColor_4px,transparent_4px,transparent_7px)]"
        />
        <span>{p95Label}</span>
      </span>
      <span className="ml-auto" aria-hidden>
        {yAxisLabel}
      </span>
    </div>
  );
}
