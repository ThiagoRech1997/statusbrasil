---
name: add-shadcn
description: Use when installing a shadcn/ui component. Triggers on "/add-shadcn", "shadcn add", "instalar componente shadcn", or requests to add UI primitives like button, dialog, etc. Knows the project uses style "base-nova" and Tailwind v4 with inline @theme tokens.
---

# add-shadcn — instalar componente shadcn/ui

## Comando

```bash
pnpm dlx shadcn@latest add <component>
```

Não passar `--style`; já configurado em `components.json` como
`base-nova` (NÃO é `default` nem `new-york`). Não passar `--cwd` salvo
necessidade.

Componentes caem em `src/components/ui/<component>.tsx` (alias `ui` =
`@/components/ui` em `components.json`).

## Stack contextual

- **Tailwind v4** + `@tailwindcss/postcss`. NÃO existe
  `tailwind.config.js` — não criar nem editar. Tokens de tema declarados
  inline em `src/app/globals.css` no bloco `@theme inline { ... }`.
- **Icon library**: `lucide` (já em `components.json`). Não trazer
  `react-icons` nem `heroicons`.
- **Dark mode**: class-based (`.dark`), driven por `next-themes`
  (`ThemeProvider` em `src/components/theme-provider.tsx`). Componentes
  shadcn já lidam via `dark:` utilities.
- `<html>` tem `suppressHydrationWarning` para absorver flip de classe
  do tema — não remover.

## Tokens semânticos de status

Para UI de **status de serviço** (operational/degraded/down) usar SEMPRE
os tokens semânticos: `operational`, `degraded`, `down` e os respectivos
`-foreground`. Nunca usar `green-500`/`yellow-500`/`red-500` cru — quebra
em dark mode e em a11y. Os tokens estão definidos em `globals.css`.

## Após instalar

- Abrir o componente gerado e remover dependências de fontes/ícones que
  não estão no repo.
- `pnpm format` para alinhar quotes/semis ao Biome.
- `pnpm typecheck`.
