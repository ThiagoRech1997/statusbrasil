# 0005. Plausible Analytics instead of Google Analytics

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

StatusBrasil is a public site about availability of government services. We need basic usage signals — pageviews, referrers, broad locale split — to know whether the dashboard is reaching its audience and which services people care about. We do **not** need behavioural funnels, ad attribution, or per-user identification.

Constraints:

- The site is governed by AGPL-3.0 (ADR-0006) and aimed at a Brazilian audience subject to the **LGPD** (Lei Geral de Proteção de Dados). Loading Google Analytics would oblige us to serve a consent banner, segment cookie-state, and document third-party transfers. Each of those is a separate ongoing maintenance burden for a project that does not need behavioural data.
- Our Content Security Policy (`src/proxy.ts:7`) is intentionally tight — adding GA would mean allowlisting a much wider set of script and image origins.
- The project values transparency about its own infrastructure: a privacy-respecting analytics tool is consistent with the editorial stance of "raw numbers, no judgments."

Alternatives considered: Google Analytics 4 (rejected for the reasons above), Umami self-hosted (viable but more ops burden), no analytics (loses the signal we need to prioritize work), Cloudflare Web Analytics (acceptable fallback but ties us to a CDN we may not always use).

## Decision

**Plausible Analytics is the only product analytics tool on StatusBrasil.** The CSP allowlist already includes `https://*.plausible.io` for both `script-src` and `connect-src` (`src/proxy.ts:7`); the script integration itself is deferred to a later milestone and will land alongside its first dashboard usage.

We will not load Google Analytics, Google Tag Manager, Meta Pixel, Hotjar, or any other behavioural-tracking SDK.

## Consequences

- **Easier:** no consent banner is required under LGPD because Plausible does not set cookies and does not collect personal data. CSP stays narrow. Privacy posture is easy to explain to contributors and to readers.
- **Harder:** we lose access to GA's free funnels, demographics, and Search Console linkage. Custom events are limited to what Plausible's API exposes — fine for our use case, but a constraint to keep in mind if requirements grow.
- **Committed to:** Plausible (self-hosted or hosted) as the analytics backend, a no-cookie analytics stance, and rejecting future requests to add behavioural-tracking pixels without superseding this ADR.
