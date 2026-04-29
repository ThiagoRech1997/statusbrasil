import { useTranslations } from "next-intl";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

const NAV_KEYS = ["home", "ranking", "comparativo", "incidentes", "metodologia"] as const;

const ROUTES: Record<(typeof NAV_KEYS)[number], string> = {
  home: "/",
  ranking: "/ranking",
  comparativo: "/comparativo",
  incidentes: "/incidentes",
  metodologia: "/metodologia",
};

export function Header() {
  const t = useTranslations("Header");
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-screen-xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <span aria-hidden className="text-lg">
            🚦
          </span>
          <span>{t("siteTitle")}</span>
        </Link>

        <nav aria-label={t("siteTitle")} className="hidden flex-1 items-center gap-1 md:flex">
          {NAV_KEYS.map((key) => (
            <Link
              key={key}
              href={ROUTES[key]}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-1 md:flex-none md:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
