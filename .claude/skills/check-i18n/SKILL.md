---
name: check-i18n
description: Use to audit translation key parity between messages/pt.json and messages/en.json. Triggers on "/check-i18n", "auditar i18n", "translation parity", or before opening a PR that touches translations. Read-only — does not modify the JSON files.
---

# check-i18n — auditoria de paridade pt/en

Verifica se `messages/pt.json` e `messages/en.json` têm exatamente as
mesmas chaves (estrutura aninhada incluída). Falha de paridade resulta
em chaves traduzidas só em um idioma — bug latente.

## Comando

```bash
diff <(jq -r 'paths(scalars) | join(".")' messages/pt.json | sort) \
     <(jq -r 'paths(scalars) | join(".")' messages/en.json | sort)
```

- Saída vazia → paridade OK.
- Linhas com `<` → chave existe em pt mas falta em en.
- Linhas com `>` → chave existe em en mas falta em pt (raro; pt é
  canônico).

## Quando rodar

- Antes de abrir PR que toca `messages/`.
- Após `/add-i18n-key` para confirmar que o espelhamento funcionou.
- Como sanity check quando aparecer erro de tipo do next-intl.

## Não-objetivos

Esta skill NÃO edita os arquivos. Para corrigir uma diferença, use
`/add-i18n-key` (ou edite manualmente).

Esta skill NÃO valida que as traduções fazem sentido — só estrutura.
