"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const pathname = usePathname();
  const current = useLocale();
  const t = useTranslations("Header.localeSwitcher");

  return (
    <nav aria-label={t("label")} className="flex items-center gap-1 text-sm">
      {routing.locales.map((locale, idx) => (
        <span key={locale} className="flex items-center gap-1">
          {idx > 0 && (
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
          )}
          <Link
            href={pathname}
            locale={locale}
            aria-current={locale === current ? "true" : undefined}
            className={cn(
              "rounded px-1 font-medium uppercase tracking-wide transition-colors",
              locale === current
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </Link>
        </span>
      ))}
    </nav>
  );
}
