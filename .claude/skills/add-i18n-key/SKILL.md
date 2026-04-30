---
name: add-i18n-key
description: Use when adding a new translation key for next-intl. Triggers on "/add-i18n-key", "adicionar tradução", "nova chave i18n", or whenever a new user-facing string is being introduced. Keeps messages/pt.json and messages/en.json in sync.
---

# add-i18n-key — adicionar chave de tradução

next-intl carrega de `messages/<locale>.json`. `pt.json` é a fonte
canônica que tipa as chaves; `en.json` espelha a mesma estrutura.

## Procedimento

1. Abrir `messages/pt.json` e adicionar a chave no namespace correto,
   preservando a estrutura aninhada existente. Não reordenar chaves
   existentes — só inserir.
2. Abrir `messages/en.json` e adicionar a MESMA chave no MESMO caminho,
   com a tradução inglesa.
3. Rodar paridade: invocar `/check-i18n` ou diretamente:

   ```bash
   diff <(jq -r 'paths(scalars) | join(".")' messages/pt.json | sort) \
        <(jq -r 'paths(scalars) | join(".")' messages/en.json | sort)
   ```

   Saída vazia = paridade OK.
4. `pnpm typecheck` — next-intl deriva os tipos de chave a partir de
   `pt.json`, então um typecheck pega usos quebrados.

## Padrão de uso na app

Server component:
```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";

const t = await getTranslations("<Namespace>");
t("<key>")
```

Client component:
```tsx
"use client";
import { useTranslations } from "next-intl";

const t = useTranslations("<Namespace>");
```

Chave aninhada: `t("nav.home")` para `Header.nav.home` quando o namespace
for `Header`.

## Convenções já presentes no repo

- Namespaces são PascalCase (`Header`, `A11y`).
- Sub-chaves são camelCase (`siteTitle`, `themeToggle.label`).
- Strings em português usam acentuação completa; em inglês, US English.
