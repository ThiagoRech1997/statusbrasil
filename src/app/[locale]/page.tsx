import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Header");

  return (
    <section className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        {t("siteTitle")}
      </h1>
      <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
        {t("tagline")}
      </p>
    </section>
  );
}
