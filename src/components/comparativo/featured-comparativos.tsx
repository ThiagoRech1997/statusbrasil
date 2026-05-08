import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  type Comparativo,
  type ComparativoId,
  COMPARATIVOS,
  comparativoQueryString,
} from "@/lib/editorial/comparativos";

export interface FeaturedComparativosProps {
  /** Override the default curated list (used by tests). */
  comparativos?: readonly Comparativo[];
}

export function FeaturedComparativos({
  comparativos = COMPARATIVOS,
}: FeaturedComparativosProps) {
  const t = useTranslations("Comparativo");
  const headingId = "featured-comparativos-heading";

  return (
    <section
      aria-labelledby={headingId}
      data-slot="featured-comparativos"
      className="flex flex-col gap-5"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {t("featuredHeading")}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("featuredIntro")}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comparativos.map((c) => (
          <FeaturedCard key={c.id} comparativo={c} />
        ))}
      </ul>
    </section>
  );
}

function FeaturedCard({ comparativo }: { comparativo: Comparativo }) {
  const t = useTranslations("Comparativo");
  const tFeatured = useTranslations(`Comparativo.featured.${comparativo.id satisfies ComparativoId}`);

  const title = tFeatured("title");
  const angle = tFeatured("angle");
  const description = tFeatured("description");

  return (
    <li className="contents">
      <Link
        href={`/comparativo?services=${comparativoQueryString(comparativo)}`}
        aria-label={t("cardAriaLabel", { title })}
        data-slot="featured-comparativo-card"
        data-comparativo={comparativo.id}
        className="group/card flex h-full flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {angle}
        </span>
        <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <span
          aria-hidden
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-foreground"
        >
          {t("cardCta")}
          <span className="transition-transform group-hover/card:translate-x-0.5">→</span>
        </span>
      </Link>
    </li>
  );
}
