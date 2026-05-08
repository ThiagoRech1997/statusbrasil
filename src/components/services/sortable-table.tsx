"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { CurrentStatus, ServiceWithStatus } from "@/lib/queries/services";
import { cn } from "@/lib/utils";

export interface SortableServicesTableProps {
  services: ServiceWithStatus[];
  className?: string;
}

const STATUS_BADGE: Record<CurrentStatus, string> = {
  operational: "bg-operational text-operational-foreground",
  degraded: "bg-degraded text-degraded-foreground",
  down: "bg-down text-down-foreground",
  unknown: "bg-muted text-muted-foreground",
};

function formatUptime(pct: number | null, unknown: string): string {
  if (pct === null) return unknown;
  return `${pct.toFixed(1)}%`;
}

export function SortableServicesTable({ services, className }: SortableServicesTableProps) {
  const t = useTranslations("SortableServicesTable");
  const tCat = useTranslations("Categories");

  const [sortCol, setSortCol] = useQueryState("sort", parseAsString.withDefault("name"));
  const [sortDir, setSortDir] = useQueryState("dir", parseAsString.withDefault("asc"));
  const [categoryFilter, setCategoryFilter] = useQueryState(
    "category",
    parseAsString.withDefault(""),
  );
  const [statusFilter, setStatusFilter] = useQueryState("status", parseAsString.withDefault(""));

  const sorting: SortingState = useMemo(
    () => [{ id: sortCol, desc: sortDir === "desc" }],
    [sortCol, sortDir],
  );

  const columnFilters: ColumnFiltersState = useMemo(
    () => [
      ...(categoryFilter ? [{ id: "category", value: categoryFilter }] : []),
      ...(statusFilter ? [{ id: "status", value: statusFilter }] : []),
    ],
    [categoryFilter, statusFilter],
  );

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    if (first) {
      void setSortCol(first.id);
      void setSortDir(first.desc ? "desc" : "asc");
    }
  };

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater;
    const cat = next.find((f) => f.id === "category");
    const st = next.find((f) => f.id === "status");
    void setCategoryFilter((cat?.value as string | undefined) ?? null);
    void setStatusFilter((st?.value as string | undefined) ?? null);
  };

  const columns: ColumnDef<ServiceWithStatus>[] = useMemo(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("columns.name"),
        enableSorting: true,
      },
      {
        id: "agency",
        accessorKey: "agency",
        header: t("columns.agency"),
        enableSorting: true,
      },
      {
        id: "category",
        accessorKey: "category",
        header: t("columns.category"),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: "equals",
        cell: ({ getValue }) => {
          const cat = getValue<string>();
          const label = (() => {
            try {
              return tCat(cat as Parameters<typeof tCat>[0]);
            } catch {
              return cat;
            }
          })();
          return label;
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("columns.status"),
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: "equals",
        sortingFn: (a, b) => {
          const order: CurrentStatus[] = ["down", "degraded", "unknown", "operational"];
          return (
            order.indexOf(a.getValue<CurrentStatus>("status")) -
            order.indexOf(b.getValue<CurrentStatus>("status"))
          );
        },
      },
      {
        id: "uptime1h",
        accessorKey: "uptime1h",
        header: t("columns.uptime"),
        enableSorting: true,
        sortUndefined: "last",
        cell: ({ getValue }) => formatUptime(getValue<number | null>(), t("uptimeUnknown")),
      },
    ],
    [t, tCat],
  );

  const table = useReactTable({
    data: services,
    columns,
    state: { sorting, columnFilters },
    onSortingChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const categories = useMemo(
    () => [...new Set(services.map((s) => s.category))].sort(),
    [services],
  );

  const statuses: CurrentStatus[] = ["operational", "degraded", "down", "unknown"];

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("flex flex-col gap-4", className)} data-slot="sortable-services-table">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.categoryLabel")}
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => void setCategoryFilter(e.target.value || null)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("filter.allCategories")}</option>
            {categories.map((cat) => {
              const label = (() => {
                try {
                  return tCat(cat as Parameters<typeof tCat>[0]);
                } catch {
                  return cat;
                }
              })();
              return (
                <option key={cat} value={cat}>
                  {label}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filter.statusLabel")}
          </span>
          <select
            value={statusFilter}
            onChange={(e) => void setStatusFilter(e.target.value || null)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("filter.allStatuses")}</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {t(`status.${st}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p
          data-slot="sortable-services-empty"
          className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground"
        >
          {t("empty")}
        </p>
      ) : (
        <>
          {/* Desktop table (≥768px) */}
          <Table className="hidden md:table" aria-label={t("ariaLabel")}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const ariaSort: "ascending" | "descending" | "none" =
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
                    const colLabel = String(
                      flexRender(header.column.columnDef.header, header.getContext()),
                    );
                    const sortLabel = canSort
                      ? sorted === "asc"
                        ? t("sort.ascendingNow", { column: colLabel })
                        : sorted === "desc"
                          ? t("sort.descendingNow", { column: colLabel })
                          : t("sort.sortBy", { column: colLabel })
                      : undefined;

                    return (
                      <TableHead
                        key={header.id}
                        scope="col"
                        aria-sort={canSort ? ariaSort : undefined}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label={sortLabel}
                            className="inline-flex items-center gap-1.5 rounded font-medium hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon sorted={sorted} />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                  <TableHead scope="col" className="w-10">
                    <span className="sr-only">{t("viewServiceText")}</span>
                  </TableHead>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const svc = row.original;
                return (
                  <TableRow key={svc.slug} data-slug={svc.slug} data-status={svc.status}>
                    <TableCell className="font-medium">{svc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{svc.agency}</TableCell>
                    <TableCell>
                      {(() => {
                        try {
                          return tCat(svc.category as Parameters<typeof tCat>[0]);
                        } catch {
                          return svc.category;
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={svc.status} label={t(`status.${svc.status}`)} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatUptime(svc.uptime1h, t("uptimeUnknown"))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/servico/${svc.slug}`}
                        aria-label={t("viewService", { name: svc.name })}
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

          {/* Mobile card list (<768px) */}
          <ul
            className="flex flex-col gap-3 md:hidden"
            data-slot="sortable-services-cards"
            aria-label={t("ariaLabel")}
          >
            {rows.map((row) => {
              const svc = row.original;
              const catLabel = (() => {
                try {
                  return tCat(svc.category as Parameters<typeof tCat>[0]);
                } catch {
                  return svc.category;
                }
              })();
              return (
                <li
                  key={svc.slug}
                  data-slug={svc.slug}
                  data-status={svc.status}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{svc.name}</span>
                    <StatusBadge status={svc.status} label={t(`status.${svc.status}`)} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{t("columns.agency")}</dt>
                    <dd>{svc.agency}</dd>
                    <dt className="text-muted-foreground">{t("columns.category")}</dt>
                    <dd>{catLabel}</dd>
                    <dt className="text-muted-foreground">{t("columns.uptime")}</dt>
                    <dd className="tabular-nums">
                      {formatUptime(svc.uptime1h, t("uptimeUnknown"))}
                    </dd>
                  </dl>
                  <Link
                    href={`/servico/${svc.slug}`}
                    aria-label={t("viewService", { name: svc.name })}
                    className="self-end text-xs font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    {t("viewServiceText")}
                    <ChevronRight
                      aria-hidden
                      className="-mr-1 ml-0.5 inline size-3.5 align-text-bottom"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (!sorted) return <ArrowUpDown aria-hidden className="size-3.5 text-muted-foreground/70" />;
  return sorted === "asc" ? (
    <ArrowUp aria-hidden className="size-3.5" />
  ) : (
    <ArrowDown aria-hidden className="size-3.5" />
  );
}

function StatusBadge({ status, label }: { status: CurrentStatus; label: string }) {
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE[status],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
