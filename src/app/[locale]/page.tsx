import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContrasteDoDia } from "@/components/contraste-do-dia";
import { DowntimeTicker } from "@/components/downtime-ticker";
import { EmQuedaAgora } from "@/components/em-queda-agora";
import { ServiceStatusCard } from "@/components/service-status-card";
import { db } from "@/lib/db";
import { getHomeDashboard, type HomeCategoryGroup } from "@/lib/queries/services";
import { getCumulativeDowntime24h } from "@/lib/queries/uptime";
import { buildHomeJsonLd, serializeJsonLd } from "@/lib/seo/home-jsonld";

export const revalidate = 60;

const FALLBACK_SITE_URL = "http://localhost:3000";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tHome, tCategories, groups, downtimeBySlug] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Categories"),
    getHomeDashboard(db),
    getCumulativeDowntime24h(db),
  ]);

  const jsonLd = serializeJsonLd(
    buildHomeJsonLd({
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL,
      locale,
      name: tHome("heading"),
      description: tHome("tagline"),
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined; serializeJsonLd escapes `<` to keep the tag safe.
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <section className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {tHome("heading")}
        </h1>
        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          {tHome("tagline")}
        </p>
      </section>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {tHome("empty")}
        </p>
      ) : (
        <>
          <DowntimeTicker
            downtimeBySlug={downtimeBySlug}
            services={groups.flatMap((g) => g.services)}
          />
          <EmQuedaAgora groups={groups} />
          <ContrasteDoDia services={groups.flatMap((g) => g.services)} />
          <nav aria-label={tHome("servicesNavLabel")} className="flex flex-col gap-10">
            {groups.map((group) => (
              <CategorySection
                key={group.category}
                group={group}
                categoryLabel={categoryLabel(tCategories, group.category)}
              />
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

function CategorySection({
  group,
  categoryLabel,
}: {
  group: HomeCategoryGroup;
  categoryLabel: string;
}) {
  const headingId = `category-${group.category}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
        {categoryLabel}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-4">
        {group.services.map((svc) => (
          <ServiceStatusCard
            key={svc.slug}
            slug={svc.slug}
            name={svc.name}
            agency={svc.agency}
            status={svc.status}
            uptime7dPct={svc.uptime7dPct}
            lastIncidentAt={svc.lastIncidentAt}
          />
        ))}
      </div>
    </section>
  );
}

function categoryLabel(
  t: Awaited<ReturnType<typeof getTranslations<"Categories">>>,
  slug: string,
): string {
  return t.has(slug) ? t(slug) : slug.charAt(0).toUpperCase() + slug.slice(1);
}
