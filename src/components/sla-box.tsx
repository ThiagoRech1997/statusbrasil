"use client";

import { Info } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface SLABoxProps {
  /** Target uptime in percent (e.g., 99.5). Pass null when no SLA target is published. */
  target: number | null;
  /** Actual uptime % for the calendar month containing `now`. */
  currentMonth: number | null;
  /** Actual uptime % for the calendar month preceding `now`. */
  previousMonth: number | null;
  /** Actual uptime % for the year-to-date window ending at `now`. */
  yearToDate: number | null;
  /** Reference time used to label periods. Defaults to `new Date()`. Pin in tests. */
  now?: Date;
  className?: string;
}

type PeriodKey = "currentMonth" | "previousMonth" | "yearToDate";

type Comparison = "above" | "below" | "no-target" | "no-data";

interface PeriodEntry {
  key: PeriodKey;
  label: string;
  rangeLabel: string;
  actual: number | null;
}

function compareToTarget(actual: number | null, target: number | null): Comparison {
  if (actual == null) return "no-data";
  if (target == null) return "no-target";
  return actual >= target ? "above" : "below";
}

const DOT_CLASS: Record<Comparison, string> = {
  above: "bg-operational",
  below: "bg-down",
  "no-target": "bg-muted-foreground/40",
  "no-data": "bg-muted-foreground/40",
};

const DELTA_TEXT_CLASS: Record<Comparison, string> = {
  above: "text-operational-foreground",
  below: "text-down-foreground",
  "no-target": "text-muted-foreground",
  "no-data": "text-muted-foreground",
};

export function SLABox({
  target,
  currentMonth,
  previousMonth,
  yearToDate,
  now,
  className,
}: SLABoxProps) {
  const t = useTranslations("SLABox");
  const format = useFormatter();
  const reference = now ?? new Date();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const headingId = useId();
  const tooltipId = useId();

  const formatPct = (value: number) =>
    format.number(value / 100, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });

  const formatDelta = (value: number) =>
    format.number(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "never",
    });

  const monthLabel = (date: Date) => format.dateTime(date, { month: "long", year: "numeric" });

  const previousMonthDate = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1),
  );

  const currentMonthDate = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );

  const periods: PeriodEntry[] = [
    {
      key: "currentMonth",
      label: t("periods.currentMonth"),
      rangeLabel: monthLabel(currentMonthDate),
      actual: currentMonth,
    },
    {
      key: "previousMonth",
      label: t("periods.previousMonth"),
      rangeLabel: monthLabel(previousMonthDate),
      actual: previousMonth,
    },
    {
      key: "yearToDate",
      label: t("periods.yearToDate", { year: reference.getUTCFullYear() }),
      rangeLabel: String(reference.getUTCFullYear()),
      actual: yearToDate,
    },
  ];

  const targetLabel = target != null ? formatPct(target) : null;

  return (
    <section
      data-slot="sla-box"
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-heading text-base font-semibold">
          {t("heading")}
        </h3>
        <p className="text-muted-foreground" data-slot="sla-target">
          {targetLabel != null ? `${t("targetLabel")} · ${targetLabel}` : t("targetMissing")}
        </p>
        <button
          type="button"
          onClick={() => setTooltipOpen((v) => !v)}
          aria-expanded={tooltipOpen}
          aria-controls={tooltipId}
          aria-label={t("formulaToggle")}
          className="ml-auto inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info aria-hidden className="size-4" />
        </button>
      </header>

      {tooltipOpen ? (
        <div
          id={tooltipId}
          data-slot="sla-formula"
          className="flex flex-col gap-2 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground"
        >
          <p>{t("formulaText")}</p>
          <Link
            href="/metodologia#sla"
            className="self-start font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {t("methodologyLink")}
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border" data-slot="sla-periods">
        {periods.map((entry) => {
          const comparison = compareToTarget(entry.actual, target);
          const ariaLabel =
            entry.actual == null
              ? t("rowAriaUnknown", { period: entry.label, rangeLabel: entry.rangeLabel })
              : t("rowAria", {
                  period: entry.label,
                  rangeLabel: entry.rangeLabel,
                  value: formatPct(entry.actual),
                  comparison: comparisonLabel(comparison, target, formatPct, t),
                });

          const delta = entry.actual != null && target != null ? entry.actual - target : null;

          return (
            <li
              key={entry.key}
              data-period={entry.key}
              data-comparison={comparison}
              aria-label={ariaLabel}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="flex flex-col">
                <span aria-hidden className="font-medium">
                  {entry.label}
                </span>
                <span aria-hidden className="text-xs text-muted-foreground">
                  {entry.rangeLabel}
                </span>
              </span>
              <span aria-hidden className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", DOT_CLASS[comparison])} />
                <span className="font-medium tabular-nums" data-slot="sla-actual">
                  {entry.actual != null ? formatPct(entry.actual) : t("actualUnknown")}
                </span>
                {delta != null ? (
                  <span
                    className={cn(
                      "min-w-[8ch] text-right text-xs tabular-nums",
                      DELTA_TEXT_CLASS[comparison],
                    )}
                    data-slot="sla-delta"
                  >
                    {deltaText(delta, t, formatDelta)}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        href="/metodologia#sla"
        data-slot="sla-methodology-link"
        className="self-start text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
      >
        {t("methodologyLink")} →
      </Link>
    </section>
  );
}

function comparisonLabel(
  comparison: Comparison,
  target: number | null,
  formatPct: (value: number) => string,
  t: ReturnType<typeof useTranslations<"SLABox">>,
): string {
  if (target == null) return t("comparisonNoTarget");
  const targetText = formatPct(target);
  return comparison === "above"
    ? t("comparisonAbove", { target: targetText })
    : t("comparisonBelow", { target: targetText });
}

function deltaText(
  delta: number,
  t: ReturnType<typeof useTranslations<"SLABox">>,
  formatDelta: (value: number) => string,
): string {
  if (delta === 0) return t("deltaMet");
  if (delta > 0) return t("deltaAbove", { value: formatDelta(delta) });
  return t("deltaBelow", { value: `−${formatDelta(delta)}` });
}
