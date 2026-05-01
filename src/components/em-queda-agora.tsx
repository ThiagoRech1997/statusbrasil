import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type EmQuedaService, pickEmQuedaAgora } from "@/lib/editorial/em-queda";
import type { HomeCategoryGroup } from "@/lib/queries/services";
import { cn } from "@/lib/utils";

const PILL_CLASSES: Record<"down" | "degraded", string> = {
  down: "bg-down text-down-foreground",
  degraded: "bg-degraded text-degraded-foreground",
};

export interface EmQuedaAgoraProps {
  groups: HomeCategoryGroup[];
  /** Reference time for relative formatting; pin in tests for stable output. */
  now?: Date;
}

export function EmQuedaAgora({ groups, now }: EmQuedaAgoraProps) {
  const t = useTranslations("EmQuedaAgora");
  const flagged = pickEmQuedaAgora(groups);
  if (flagged.length === 0) return null;

  const headingId = "em-queda-agora-heading";

  return (
    <section
      aria-live="polite"
      aria-labelledby={headingId}
      data-slot="em-queda-agora"
      className="flex flex-col gap-3 rounded-xl border-l-4 border-down bg-card p-5 ring-1 ring-foreground/10"
    >
      <header className="flex flex-col gap-0.5">
        <h2 id={headingId} className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("summary", { count: flagged.length })}</p>
      </header>
      <ul className="flex flex-col">
        {flagged.map((svc, idx) => (
          <li key={svc.slug} className={cn(idx > 0 && "border-t border-border/60")}>
            <EmQuedaItem service={svc} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmQuedaItem({ service, now }: { service: EmQuedaService; now?: Date }) {
  const t = useTranslations("EmQuedaAgora");
  const tCard = useTranslations("ServiceStatusCard");
  const format = useFormatter();

  const incidentDate = service.lastIncidentAt;
  const incidentRelative =
    incidentDate != null && !Number.isNaN(incidentDate.getTime())
      ? format.relativeTime(incidentDate, now ?? new Date())
      : null;

  const statusLabel = tCard(`status.${service.status}`);
  const ariaStatus = tCard(`ariaStatus.${service.status}`);

  const ariaLabel =
    incidentRelative != null
      ? t("itemAriaWithTime", {
          name: service.name,
          agency: service.agency,
          status: ariaStatus,
          time: incidentRelative,
        })
      : t("itemAriaNoTime", {
          name: service.name,
          agency: service.agency,
          status: ariaStatus,
        });

  return (
    <Link
      href={`/servico/${service.slug}`}
      aria-label={ariaLabel}
      data-slot="em-queda-item"
      data-status={service.status}
      className="group/item flex items-start gap-3 rounded-md py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          PILL_CLASSES[service.status],
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {statusLabel}
      </span>
      <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <span className="truncate font-medium">{service.name}</span>
        <span className="truncate text-xs text-muted-foreground">{service.agency}</span>
      </div>
      <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
        {incidentRelative != null ? t("lastUpdate", { time: incidentRelative }) : t("noLastUpdate")}
      </span>
    </Link>
  );
}
