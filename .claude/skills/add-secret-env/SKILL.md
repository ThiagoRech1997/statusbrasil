---
name: add-secret-env
description: Use whenever a new sensitive environment variable is introduced (API tokens, database URLs, webhook secrets, signing keys). Triggers on "/add-secret-env", "adicionar env secreta", "nova variável de ambiente sensível". Updates the pino logger redact list so the value never leaks to logs.
---

# add-secret-env — registrar env sensível na redact list

O logger pino em `src/lib/logger.ts` mascara automaticamente qualquer
chave listada em `REDACT_KEYS` quando ela aparece em um log object. Toda
env sensível introduzida no projeto DEVE entrar nessa lista.

## Procedimento

1. Abrir `src/lib/logger.ts`.
2. Adicionar a nova chave (all-caps, snake_case) ao array `REDACT_KEYS`,
   mantendo a literal `as const` no final:

   ```ts
   const REDACT_KEYS = [
     "CRON_SECRET",
     "METRICS_SECRET",
     "DATABASE_URL",
     "GATUS_API_TOKEN",
     "SENTRY_DSN",
     "<NOVA_CHAVE>",
   ] as const;
   ```

3. `pnpm typecheck`.

## Por que importa

`redactPaths` é derivado da lista e cobre tanto a chave top-level quanto
qualquer ocorrência aninhada (`*.<KEY>`). Sem isso, `logger.info({ env:
process.env })` ou objetos contendo o token vazam em prod (JSON) e em
dev (pretty).

## Lista atual (referência)

`CRON_SECRET`, `METRICS_SECRET`, `DATABASE_URL`, `GATUS_API_TOKEN`,
`SENTRY_DSN`.

## Boas práticas adicionais

- Nunca logar `process.env.<KEY>` cru, mesmo com redact — passar pelo
  logger é a regra, não a exceção.
- Não há `.env.example` no repo no momento; documentar a env nova no
  PR/commit.
- Se a env vai ser lida em client component, ela tem que ser
  `NEXT_PUBLIC_*` E provavelmente NÃO é sensível. Se é sensível, mantenha
  server-only.
