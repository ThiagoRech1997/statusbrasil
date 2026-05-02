import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type ContrastService, pickContrast } from "@/lib/editorial/contrastes";
import type { ServiceCardRow } from "@/lib/queries/services";
import { cn } from "@/lib/utils";

export interface ContrasteDoDiaProps {
  services: ServiceCardRow[];
}

export function ContrasteDoDia({ services }: ContrasteDoDiaProps) {
  const t = useTranslations("ContrasteDoDia");
  const format = useFormatter();
  const pair = pickContrast(services);
  if (!pair) return null;

  const headingId = "contraste-do-dia-heading";
  const bestPct = formatPercent(format, pair.best.uptime24hPct);
  const worstPct = formatPercent(format, pair.worst.uptime24hPct);
  const gapValue = Math.abs(pair.best.uptime24hPct - pair.worst.uptime24hPct);
  const gapFormatted = format.number(gapValue, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const ariaLabel = t("ariaLabel", {
    heading: t("heading"),
    bestName: pair.best.name,
    bestCategory: t("sideLabelArrecadacao"),
    bestPct,
    worstName: pair.worst.name,
    worstCategory: t("sideLabelAtendimento"),
    worstPct,
    gap: gapFormatted,
  });

  return (
    <section
      aria-labelledby={headingId}
      aria-label={ariaLabel}
      data-slot="contraste-do-dia"
      className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
          {t("heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ContrastSide
          tone="good"
          sideLabel={t("sideLabelArrecadacao")}
          uptimeLabel={t("uptimeWindow")}
          uptimeFormatted={bestPct}
          service={pair.best}
        />
        <ContrastSide
          tone="bad"
          sideLabel={t("sideLabelAtendimento")}
          uptimeLabel={t("uptimeWindow")}
          uptimeFormatted={worstPct}
          service={pair.worst}
        />
      </div>

      <p aria-hidden className="text-center text-sm font-medium text-muted-foreground sm:text-base">
        {t("gap", { value: gapFormatted })}
      </p>
    </section>
  );
}

function ContrastSide({
  tone,
  sideLabel,
  uptimeLabel,
  uptimeFormatted,
  service,
}: {
  tone: "good" | "bad";
  sideLabel: string;
  uptimeLabel: string;
  uptimeFormatted: string;
  service: ContrastService;
}) {
  return (
    <Link
      href={`/servico/${service.slug}`}
      data-slot="contraste-side"
      data-tone={tone}
      className={cn(
        "group/side flex flex-col gap-3 rounded-lg p-4 ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "good"
          ? "bg-operational/40 ring-operational-foreground/20 hover:bg-operational/60"
          : "bg-degraded/40 ring-degraded-foreground/20 hover:bg-degraded/60",
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          tone === "good" ? "text-operational-foreground" : "text-degraded-foreground",
        )}
      >
        {sideLabel}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-base font-medium leading-snug">{service.name}</span>
        <span className="text-xs text-muted-foreground">{service.agency}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-semibold tabular-nums sm:text-4xl">
          {uptimeFormatted}
        </span>
        <span className="text-xs text-muted-foreground">{uptimeLabel}</span>
      </div>
    </Link>
  );
}

function formatPercent(format: ReturnType<typeof useFormatter>, value: number): string {
  return format.number(value / 100, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
