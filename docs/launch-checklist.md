# Launch Checklist — StatusBrasil v0.1.0

Section 7 Definition-of-Done. Each item must be checked with evidence before tagging `v0.1.0`.

**Coverage:** 10/14 ✅ — 4 pending M7 sub-tasks

| # | Item | Status | Evidence / Ticket |
|---|------|--------|-------------------|
| 1 | Home renderiza com dados reais do Gatus em produção | ❌ Pendente | M7.12 — verificar após deploy |
| 2 | 15+ serviços catalogados | ❌ Pendente | M7.12 — verificar `/api/v1/services` em prod |
| 3 | Página de serviço individual funcional | ✅ 2026-05-08 | [PR #2](https://github.com/ThiagoRech1997/statusbrasil/pull/2) · TFR-162 — `/[locale]/servico/[slug]` RSC |
| 4 | Ranking ordenável e exportável CSV | ✅ 2026-05-08 | [PR #9](https://github.com/ThiagoRech1997/statusbrasil/pull/9) + [PR #10](https://github.com/ThiagoRech1997/statusbrasil/pull/10) + [PR #6](https://github.com/ThiagoRech1997/statusbrasil/pull/6) · TFR-90 + CSV export |
| 5 | Cards OG dinâmicos (home, serviço, incidente) | ✅ 2026-05-11 | Home OG (`06dc105`), Ranking OG ([PR #5](https://github.com/ThiagoRech1997/statusbrasil/pull/5)), Comparativo OG ([PR #12](https://github.com/ThiagoRech1997/statusbrasil/pull/12)), Incident OG ([PR #19](https://github.com/ThiagoRech1997/statusbrasil/pull/19)) |
| 6 | API pública documentada e rate-limited | ✅ 2026-05-08 | [PR #6](https://github.com/ThiagoRech1997/statusbrasil/pull/6) · `/api/v1/*` + Scalar UI em `/api/docs` + `@upstash/ratelimit` |
| 7 | Imagem Docker buildando em CI multi-arch | ❌ Pendente | M7.8 — `deploy.yml` com build multiarch + push GHCR |
| 8 | Lighthouse ≥90 perf+a11y+best-practices+seo na home mobile | ✅ 2026-05-11 | [PR #25](https://github.com/ThiagoRech1997/statusbrasil/pull/25) · TFR-107 — `lighthouserc.js` + `lighthouse.yml`, 6 páginas, mobile slow-3G |
| 9 | Smoke E2E passando em CI | ✅ 2026-05-09 | [PR #3](https://github.com/ThiagoRech1997/statusbrasil/pull/3) · TFR-212 — job `e2e` em `ci.yml` + Playwright full suite ([PR #22](https://github.com/ThiagoRech1997/statusbrasil/pull/22)) |
| 10 | /metodologia publicada com disclaimer + link repo | ✅ 2026-05-11 | [PR #14](https://github.com/ThiagoRech1997/statusbrasil/pull/14) · TFR-100 — `/[locale]/metodologia` + disclaimer LGPD |
| 11 | Repo público GitHub com README + AGPL + CI verde | ✅ 2026-05-08 | [github.com/ThiagoRech1997/statusbrasil](https://github.com/ThiagoRech1997/statusbrasil) · `LICENSE` (AGPL-3.0) · CI badge em `README.md` |
| 12 | Domínio prod com Cloudflare e HTTPS | ❌ Pendente | M7.8 — SSH deploy + Cloudflare DNS |
| 13 | Plausible instalado e funcionando | ❌ Pendente | M7.4 — `next/script` strategy=afterInteractive, só em prod |
| 14 | Sentry capturando erros em produção | ❌ Pendente | M7.7 — live test em staging confirma capture+alert |

---

## Itens pendentes → tickets responsáveis

| Pendência | Ticket | Assignee |
|-----------|--------|----------|
| Deploy multi-arch + domínio + HTTPS | TFR-114 (M7.8) | BackendDev |
| Plausible | TFR-110 (M7.4) | BackendDev |
| Sentry live test | TFR-113 (M7.7) | BackendDev |
| Verificar dados reais em prod | TFR-118 (M7.12) | BackendDev |

---

_Atualizado por: FrontendDev — 2026-05-11_
_Fechar M7.11 quando coverage = 14/14._
