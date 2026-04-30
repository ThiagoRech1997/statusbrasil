---
name: add-api-route
description: Use when adding a route handler under src/app/api/<path>/route.ts. Triggers on "/add-api-route", "criar rota de API", "nova API route", "add endpoint". Knows Next 16 conventions (Promise-typed dynamic params) and the server-only logger.
---

# add-api-route — novo route handler

## Caminho

`src/app/api/<path>/route.ts` (ou aninhado: `src/app/api/<a>/<b>/route.ts`).

Para rota dinâmica, usar segmento `[param]`: `src/app/api/items/[id]/route.ts`.

## Template — rota estática

```ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
```

Referência viva: `src/app/api/health/route.ts`.

## Template — rota dinâmica (Next 16)

```ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ id });
}
```

`params` é `Promise<{ ... }>` em Next 16 — `await` antes de destruturar.
Mesma regra para `searchParams` em pages.

## Logging

```ts
import { logger } from "@/lib/logger";

logger.info({ route: "/api/foo" }, "handled");
```

Logger é `server-only` (marcado em `src/lib/logger.ts`). NUNCA importar
de client component — vai estourar em build.

Pino redacta automaticamente as chaves em `REDACT_KEYS`. Se a rota
introduzir uma env nova sensível, invocar `/add-secret-env` para
estender a lista.

## Constraint global

`/api/health` é o healthcheck do container Docker. Não removê-lo nem
quebrar o shape `{ status, version, uptime }`.

## Verificação

```bash
pnpm typecheck
pnpm dev
curl -s http://localhost:3000/api/<path> | jq
```
