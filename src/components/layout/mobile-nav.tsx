"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

const NAV_KEYS = ["home", "ranking", "comparativo", "incidentes", "metodologia"] as const;

const ROUTES: Record<(typeof NAV_KEYS)[number], string> = {
  home: "/",
  ranking: "/ranking",
  comparativo: "/comparativo",
  incidentes: "/incidentes",
  metodologia: "/metodologia",
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("Header");

  useEffect(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </Button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label={t("siteTitle")}
          className="absolute inset-x-0 top-14 border-b border-border bg-background shadow-lg md:hidden"
        >
          <ul className="mx-auto flex max-w-screen-xl flex-col px-4 py-2 sm:px-6">
            {NAV_KEYS.map((key) => {
              const href = ROUTES[key];
              const active = href === pathname || (href !== "/" && pathname.startsWith(href));
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
                  >
                    {t(`nav.${key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
