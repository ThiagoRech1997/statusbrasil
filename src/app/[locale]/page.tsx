import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Header");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t("siteTitle")}</h1>
      <p className="max-w-md text-center text-muted-foreground">{t("tagline")}</p>
      <p className="text-xs text-muted-foreground">
        Locale: <code className="font-mono">{locale}</code>
      </p>
    </main>
  );
}
