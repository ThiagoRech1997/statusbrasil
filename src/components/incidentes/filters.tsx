"use client";

import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import type { ServiceRow } from "@/lib/queries/services";

export interface IncidentFiltersProps {
  services: ServiceRow[];
}

const inputClass =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "text-xs font-medium text-muted-foreground";

export function IncidentFilters({ services }: IncidentFiltersProps) {
  const t = useTranslations("Incidentes");

  const [service, setService] = useQueryState("service", parseAsString.withDefault(""));
  const [severity, setSeverity] = useQueryState("severity", parseAsString.withDefault(""));
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));

  const hasFilters = service !== "" || severity !== "" || from !== "" || to !== "";

  const clearFilters = () => {
    void setService("");
    void setSeverity("");
    void setFrom("");
    void setTo("");
  };

  return (
    <fieldset
      data-slot="incident-filters"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/50 p-4"
    >
      <legend className="sr-only">{t("filters.ariaLabel")}</legend>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-service" className={labelClass}>
          {t("filters.service")}
        </label>
        <select
          id="filter-service"
          value={service}
          onChange={(e) => void setService(e.target.value || "")}
          className={inputClass}
        >
          <option value="">{t("filters.allServices")}</option>
          {services.map((svc) => (
            <option key={svc.slug} value={svc.slug}>
              {svc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-severity" className={labelClass}>
          {t("filters.severity")}
        </label>
        <select
          id="filter-severity"
          value={severity}
          onChange={(e) => void setSeverity(e.target.value || "")}
          className={inputClass}
        >
          <option value="">{t("filters.allSeverities")}</option>
          <option value="partial">{t("filters.severityPartial")}</option>
          <option value="total">{t("filters.severityTotal")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-from" className={labelClass}>
          {t("filters.from")}
        </label>
        <input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => void setFrom(e.target.value || "")}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-to" className={labelClass}>
          {t("filters.to")}
        </label>
        <input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => void setTo(e.target.value || "")}
          className={inputClass}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-[34px] items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("filters.clear")}
        </button>
      )}
    </fieldset>
  );
}
