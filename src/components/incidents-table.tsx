"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { formatDowntimeDuration } from "@/lib/editorial/downtime";
import type { IncidentRow, IncidentSeverity } from "@/lib/queries/incidents";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";
export type SortableColumn = "startedAt" | "durationSeconds" | "statusCode" | "severity";

export interface IncidentsTableProps {
  incidents: IncidentRow[];
  pageSize?: number;
  defaultSort?: { column: SortableColumn; direction: SortDirection };
  /** Reference time for computing duration of open incidents. Pin in tests for stable output. */
  now?: Date;
  className?: string;
}

const SORTABLE_COLUMNS: SortableColumn[] = [
  "startedAt",
  "durationSeconds",
  "statusCode",
  "severity",
];
const MESSAGE_TRUNCATE_LIMIT = 100;

const SEVERITY_PILL: Record<IncidentSeverity, string> = {
  partial: "bg-degraded text-degraded-foreground",
  total: "bg-down text-down-foreground",
};

function severityRank(s: IncidentSeverity): number {
  return s === "partial" ? 0 : 1;
}

function elapsedSeconds(row: IncidentRow, nowMs: number): number {
  if (row.durationSeconds != null) return row.durationSeconds;
  return Math.max(0, Math.round((nowMs - row.startedAt.getTime()) / 1000));
}

function compareIncidents(
  a: IncidentRow,
  b: IncidentRow,
  column: SortableColumn,
  nowMs: number,
): number {
  switch (column) {
    case "startedAt":
      return a.startedAt.getTime() - b.startedAt.getTime();
    case "durationSeconds":
      return elapsedSeconds(a, nowMs) - elapsedSeconds(b, nowMs);
    case "statusCode":
      return (a.statusCode ?? -1) - (b.statusCode ?? -1);
    case "severity":
      return severityRank(a.severity) - severityRank(b.severity);
  }
}

function truncateMessage(
  msg: string | null,
  expanded: boolean,
): { display: string; truncated: boolean } {
  if (!msg) return { display: "", truncated: false };
  const truncated = msg.length > MESSAGE_TRUNCATE_LIMIT;
  if (expanded || !truncated) return { display: msg, truncated };
  return { display: `${msg.slice(0, MESSAGE_TRUNCATE_LIMIT).trimEnd()}…`, truncated: true };
}

function columnKey(column: SortableColumn): "startedAt" | "duration" | "statusCode" | "severity" {
  return column === "durationSeconds" ? "duration" : column;
}

export function IncidentsTable({
  incidents,
  pageSize = 10,
  defaultSort,
  now,
  className,
}: IncidentsTableProps) {
  const t = useTranslations("IncidentsTable");
  const locale = useLocale();
  const format = useFormatter();

  const [sort, setSort] = useState<{ column: SortableColumn; direction: SortDirection }>(
    defaultSort ?? { column: "startedAt", direction: "desc" },
  );
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const referenceNow = now?.getTime() ?? Date.now();

  const sorted = useMemo(() => {
    const list = [...incidents];
    list.sort((a, b) => {
      const cmp = compareIncidents(a, b, sort.column, referenceNow);
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return list;
  }, [incidents, sort, referenceNow]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sorted.length);
  const pageRows = sorted.slice(pageStart, pageEnd);

  const handleSort = (column: SortableColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "desc" },
    );
    setPage(0);
  };

  const ariaSortFor = (column: SortableColumn): "ascending" | "descending" | "none" =>
    sort.column === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  const sortLabelFor = (column: SortableColumn): string => {
    const colLabel = t(`columns.${columnKey(column)}`);
    if (sort.column === column) {
      return sort.direction === "asc"
        ? t("sort.ascendingNow", { column: colLabel })
        : t("sort.descendingNow", { column: colLabel });
    }
    return t("sort.sortBy", { column: colLabel });
  };

  const formatDuration = (row: IncidentRow): string => {
    if (row.durationSeconds != null && row.endedAt != null) {
      return formatDowntimeDuration(locale, row.durationSeconds);
    }
    const elapsed = elapsedSeconds(row, referenceNow);
    const formatted = formatDowntimeDuration(locale, elapsed);
    return formatted ? `${formatted} (${t("ongoing")})` : t("ongoing");
  };

  const formatStarted = (d: Date) =>
    format.dateTime(d, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (incidents.length === 0) {
    return (
      <p
        data-slot="incidents-table-empty"
        className={cn(
          "rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {t("empty")}
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} data-slot="incidents-table">
      <Table className="hidden sm:table" aria-label={t("ariaLabel")}>
        <TableHeader>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col}
                aria-sort={ariaSortFor(col)}
                data-sort-column={col}
                data-sort-direction={sort.column === col ? sort.direction : undefined}
                scope="col"
              >
                <button
                  type="button"
                  onClick={() => handleSort(col)}
                  aria-label={sortLabelFor(col)}
                  className="inline-flex items-center gap-1.5 rounded font-medium hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t(`columns.${columnKey(col)}`)}
                  <SortIcon active={sort.column === col} direction={sort.direction} />
                </button>
              </TableHead>
            ))}
            <TableHead scope="col">{t("columns.message")}</TableHead>
            <TableHead scope="col" className="w-10">
              <span className="sr-only">{t("viewIncidentText")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row) => {
            const { display, truncated } = truncateMessage(row.errorMessage, expanded.has(row.id));
            return (
              <TableRow key={row.id} data-incident-id={row.id} data-severity={row.severity}>
                <TableCell className="tabular-nums">{formatStarted(row.startedAt)}</TableCell>
                <TableCell className="tabular-nums">{formatDuration(row)}</TableCell>
                <TableCell className="tabular-nums">{row.statusCode ?? t("missing")}</TableCell>
                <TableCell>
                  <SeverityBadge severity={row.severity} />
                </TableCell>
                <TableCell className="max-w-[28rem] whitespace-normal text-muted-foreground">
                  {row.errorMessage == null ? (
                    <span aria-hidden>{t("missing")}</span>
                  ) : (
                    <span>
                      {display}
                      {truncated ? (
                        <button
                          type="button"
                          aria-expanded={expanded.has(row.id)}
                          aria-label={
                            expanded.has(row.id) ? t("collapseMessage") : t("expandMessage")
                          }
                          onClick={() => toggleExpanded(row.id)}
                          className="ml-1 inline align-baseline text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {expanded.has(row.id) ? t("collapseMessage") : t("expandMessage")}
                        </button>
                      ) : null}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/incidentes/${row.id}`}
                    aria-label={t("viewIncident", { id: row.id })}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ul
        className="flex flex-col gap-3 sm:hidden"
        data-slot="incidents-cards"
        aria-label={t("ariaLabel")}
      >
        {pageRows.map((row) => {
          const { display, truncated } = truncateMessage(row.errorMessage, expanded.has(row.id));
          return (
            <li
              key={row.id}
              data-incident-id={row.id}
              data-severity={row.severity}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium tabular-nums">
                  <span className="sr-only">{`${t("columns.startedAt")}: `}</span>
                  {formatStarted(row.startedAt)}
                </span>
                <SeverityBadge severity={row.severity} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t("columns.duration")}</dt>
                <dd className="tabular-nums">{formatDuration(row)}</dd>
                <dt className="text-muted-foreground">{t("columns.statusCode")}</dt>
                <dd className="tabular-nums">{row.statusCode ?? t("missing")}</dd>
              </dl>
              {row.errorMessage != null ? (
                <p className="text-xs text-muted-foreground">
                  {display}
                  {truncated ? (
                    <button
                      type="button"
                      aria-expanded={expanded.has(row.id)}
                      aria-label={expanded.has(row.id) ? t("collapseMessage") : t("expandMessage")}
                      onClick={() => toggleExpanded(row.id)}
                      className="ml-1 inline align-baseline text-foreground underline-offset-2 hover:underline"
                    >
                      {expanded.has(row.id) ? t("collapseMessage") : t("expandMessage")}
                    </button>
                  ) : null}
                </p>
              ) : null}
              <Link
                href={`/incidentes/${row.id}`}
                aria-label={t("viewIncident", { id: row.id })}
                className="self-end text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {t("viewIncidentText")}
                <ChevronRight
                  aria-hidden
                  className="-mr-1 ml-0.5 inline size-3.5 align-text-bottom"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        rangeFrom={pageStart + 1}
        rangeTo={pageEnd}
        rangeTotal={sorted.length}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
      />
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown aria-hidden className="size-3.5 text-muted-foreground/70" />;
  return direction === "asc" ? (
    <ArrowUp aria-hidden className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5" />
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const t = useTranslations("IncidentsTable");
  return (
    <span
      data-slot="severity-badge"
      data-severity={severity}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        SEVERITY_PILL[severity],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(`severityLabel.${severity}`)}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  rangeFrom,
  rangeTo,
  rangeTotal,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  rangeFrom: number;
  rangeTo: number;
  rangeTotal: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("IncidentsTable");
  if (totalPages <= 1) return null;
  return (
    <nav
      data-slot="incidents-pagination"
      aria-label={t("pagination.navAriaLabel")}
      className="flex items-center justify-between gap-3 text-sm"
    >
      <span className="text-muted-foreground" aria-live="polite">
        {t("pagination.summary", { page: page + 1, total: totalPages })}
      </span>
      <span className="sr-only">
        {t("pagination.rangeAria", { from: rangeFrom, to: rangeTo, total: rangeTotal })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 0}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("pagination.previous")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages - 1}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("pagination.next")}
        </button>
      </div>
    </nav>
  );
}
