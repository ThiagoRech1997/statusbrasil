import { useLocale, useTranslations } from "next-intl";
import {
  formatDowntimeDuration,
  type NamedService,
  summarizeDowntime,
} from "@/lib/editorial/downtime";

export interface DowntimeTickerProps {
  downtimeBySlug: Record<string, number>;
  services: NamedService[];
}

export function DowntimeTicker({ downtimeBySlug, services }: DowntimeTickerProps) {
  const t = useTranslations("DowntimeTicker");
  const locale = useLocale();
  const { totalSeconds, worst } = summarizeDowntime(downtimeBySlug, services);

  const summary =
    totalSeconds <= 0
      ? t("summaryNone")
      : t("summary", { duration: formatDowntimeDuration(locale, totalSeconds) });

  const worstLine =
    worst != null && worst.seconds > 0
      ? t("worstService", {
          name: worst.name,
          duration: formatDowntimeDuration(locale, worst.seconds),
        })
      : null;

  return (
    <aside
      data-slot="downtime-ticker"
      data-state={totalSeconds > 0 ? "downtime" : "clear"}
      aria-label={t("ariaLabel", { summary: worstLine ? `${summary} ${worstLine}` : summary })}
      className="flex flex-col gap-1 rounded-xl border border-dashed border-border bg-card/40 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-baseline sm:gap-2"
    >
      <span className="font-medium text-foreground">{summary}</span>
      {worstLine ? <span aria-hidden>{worstLine}</span> : null}
    </aside>
  );
}
