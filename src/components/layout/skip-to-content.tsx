import { useTranslations } from "next-intl";

export function SkipToContent() {
  const t = useTranslations("A11y");
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow focus:ring-2 focus:ring-ring"
    >
      {t("skipToContent")}
    </a>
  );
}
