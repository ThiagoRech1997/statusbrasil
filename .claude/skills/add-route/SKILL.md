---
name: add-route
description: Use when the user wants to add a new locale-segmented page route under src/app/[locale]/<segment>/page.tsx. Triggers on "/add-route", "add a page/segment", "nova página/rota". Scaffolds the page with Next 16 App Router conventions for this repo (Promise-typed params, setRequestLocale, @/i18n/navigation imports).
---

# add-route — nova página locale-segmented

Crie a página em `src/app/[locale]/<segment>/page.tsx`. Server component
async; nada de `"use client"` no nível da página salvo se o usuário pedir.

## Template

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function <Name>Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("<Namespace>");

  return (
    <section className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col px-4 py-12 sm:px-6">
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
    </section>
  );
}
```

Exemplo canônico vivo: `src/app/[locale]/page.tsx`.

## Regras (não negociáveis)

- `params` é `Promise<{ locale: string }>` — `await params` antes de
  destruturar (Next 16 / React 19).
- Chamar `setRequestLocale(locale)` ANTES de qualquer `getTranslations`
  ou `useTranslations`, senão a página quebra em build estático.
- Imports de navegação SEMPRE de `@/i18n/navigation` — `Link`,
  `useRouter`, `redirect`, `usePathname`, `getPathname`. Nunca de
  `next/link` ou `next/navigation` direto, senão o prefixo de locale
  some.
- Path alias `@/*` → `src/*`. Não usar relativos cross-feature.

## Strings de UI

Toda string visível precisa estar em `messages/pt.json` (canônico) E
`messages/en.json`. Para isso, invoque a skill `/add-i18n-key` (ou
edite os dois arquivos manualmente mantendo a mesma estrutura).

Para link de navegação visível no header, adicionar a chave em
`Header.nav.<slug>` nos dois arquivos.

## Verificação

```bash
pnpm typecheck
pnpm dev   # abrir /pt/<segment> e /en/<segment>
```
