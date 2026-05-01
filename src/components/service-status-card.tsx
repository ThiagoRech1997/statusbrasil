import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

const PILL_CLASSES: Record<ServiceStatus, string> = {
  operational: "bg-operational text-operational-foreground",
  degraded: "bg-degraded text-degraded-foreground",
  down: "bg-down text-down-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export interface ServiceStatusCardProps {
  slug: string;
  name: string;
  agency: string;
  status: ServiceStatus;
  uptime7dPct: number | null;
  lastIncidentAt: Date | string | null;
  /** Reference time for relative formatting; pin this in tests for stable output. */
  now?: Date;
  className?: string;
}

export function ServiceStatusCard({
  slug,
  name,
  agency,
  status,
  uptime7dPct,
  lastIncidentAt,
  now,
  className,
}: ServiceStatusCardProps) {
  const t = useTranslations("ServiceStatusCard");
  const format = useFormatter();

  const statusLabel = t(`status.${status}`);
  const ariaStatus = t(`ariaStatus.${status}`);

  const uptimeFormatted =
    uptime7dPct != null
      ? format.number(uptime7dPct / 100, {
          style: "percent",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : null;

  const incidentDate = lastIncidentAt != null ? new Date(lastIncidentAt) : null;
  const incidentRelative =
    incidentDate != null && !Number.isNaN(incidentDate.getTime())
      ? format.relativeTime(incidentDate, now ?? new Date())
      : null;

  const ariaUptimePart =
    uptimeFormatted != null
      ? t("ariaUptime", { value: uptimeFormatted })
      : t("ariaUptimeUnavailable");
  const ariaIncidentPart =
    incidentRelative != null ? t("ariaLastIncident", { time: incidentRelative }) : null;

  const ariaLabel = ariaIncidentPart
    ? `${name}: ${ariaStatus}, ${ariaUptimePart}. ${ariaIncidentPart}.`
    : `${name}: ${ariaStatus}, ${ariaUptimePart}.`;

  return (
    <Link
      href={`/servico/${slug}`}
      aria-label={ariaLabel}
      data-slot="service-status-card"
      data-status={status}
      className={cn(
        "group/service-card flex flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-heading text-base font-medium leading-snug">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{agency}</span>
        </div>
        <span
          aria-hidden
          data-slot="status-pill"
          data-status={status}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            PILL_CLASSES[status],
          )}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>
      </div>

      <div aria-hidden className="flex flex-col gap-1 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">{t("uptimeLabel")}</span>
          <span className="font-medium tabular-nums">{uptimeFormatted ?? t("uptimeUnknown")}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">{t("lastIncidentLabel")}</span>
          <span className="font-medium">{incidentRelative ?? t("noRecentIncident")}</span>
        </div>
      </div>
    </Link>
  );
}
