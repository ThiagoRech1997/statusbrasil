# 0008. visx instead of Recharts

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

The dashboard's defining visualization is a bank of small uptime sparklines and a few wider charts: response-time distributions, daily availability heatmaps, and monthly trend lines. Each one is a thin variation on a primitive shape; none of them benefit from a high-level "all-in-one" chart component.

Common alternatives:

- **Recharts** — declarative, batteries-included React charting library. Easy to drop in but composes via opinionated React components that wrap d3. Customizing rendering, tuning accessibility, and rendering on the server are all friction-heavy.
- **Chart.js / react-chartjs-2** — canvas-based, hard to make screen-reader-accessible, awkward to render in RSC.
- **Plain d3** — maximum control, but we'd be hand-rolling the React lifecycle integration that visx already provides.
- **[visx](https://airbnb.io/visx/)** (Airbnb) — a thin, modular wrapper over d3 primitives (scales, shapes, axes, tooltips). Each piece is a small React component you compose yourself, which is exactly what we need for sparkline-style visuals.

For an availability dashboard, control over rendering matters: charts must read accessibly to assistive tech, must respect the `operational` / `degraded` / `down` semantic tokens (per the in-repo CSS conventions), and must look correct in both dark and light themes without relying on a library's built-in palette.

## Decision

**visx is the charting layer for StatusBrasil.** Each chart is composed from visx primitives (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/tooltip`, etc.) inside our own React components, in `src/components/charts/` (to be introduced when the first chart lands).

visx is not installed at the time of this decision. The dependency will be added when the first chart is implemented; this ADR commits to the choice so that nobody adds Recharts (or another higher-level charting library) in the meantime.

## Consequences

- **Easier:** charts inherit the design system directly — semantic-status tokens, theme-aware colors, exact-pixel sparkline layouts. SVG output is friendly to RSC and to accessibility tooling. Bundle size scales with the primitives we actually import, not with a monolithic library.
- **Harder:** every chart is more code than its Recharts equivalent. Common patterns (legend, tooltip, hover state) have to be implemented once and shared inside `src/components/charts/`. Contributors need a basic d3-scale mental model to add a new visualization.
- **Committed to:** visx as the only charting dependency, accessible SVG output as the default rendering target, and a small in-repo charts library as the reuse layer. Recharts, Chart.js, and Plotly are out of scope unless a future ADR supersedes this one.
