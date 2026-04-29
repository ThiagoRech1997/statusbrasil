import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const INTERNAL_LINKS = [
  { key: "metodologia", href: "/metodologia" },
  { key: "privacidade", href: "/privacidade" },
] as const;

const EXTERNAL_LINKS = [
  { key: "api", href: "/api/docs" },
  { key: "feed", href: "/feed.xml" },
  { key: "github", href: "https://github.com/thiagorech/status-brasil" },
] as const;

const REPO_URL = "https://github.com/thiagorech/status-brasil";
const LICENSE_URL = "https://www.gnu.org/licenses/agpl-3.0.html";

export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-semibold tracking-tight">
            <span aria-hidden className="mr-2">
              🚦
            </span>
            StatusBrasil
          </p>
          <p className="max-w-md text-muted-foreground">{t("tagline")}</p>
          <p className="text-xs text-muted-foreground">
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {t("license")}
            </a>
            <span className="px-1.5" aria-hidden>
              ·
            </span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {t("links.github")}
            </a>
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {INTERNAL_LINKS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`links.${key}`)}
            </Link>
          ))}
          {EXTERNAL_LINKS.map(({ key, href }) => (
            <a
              key={key}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`links.${key}`)}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
