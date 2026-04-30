# 0007. Biome instead of ESLint + Prettier

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

A modern TypeScript project typically pulls in two separate tools: ESLint for static analysis and Prettier for formatting. That combination has well-known costs:

- Two configurations to keep aligned (`.eslintrc`, `.prettierrc`, plus the `eslint-config-prettier` and `eslint-plugin-prettier` glue).
- Two passes over the source tree on every commit, plus an editor that runs both on save.
- A dependency tree of dozens of plugins for what should be table-stakes lint coverage of TypeScript and React.
- Conflicts at the boundaries — rules where ESLint disagrees with Prettier about formatting until a third package mediates.

For a small project where the team is one to a few maintainers, the maintenance overhead of that stack is disproportionate to its value.

[Biome](https://biomejs.dev) is a Rust-based linter and formatter that does both jobs in a single binary, with a single config file, an order of magnitude faster than ESLint+Prettier, and with an opinionated default ruleset that matches the Prettier formatting style.

## Decision

**Biome is the only linter and formatter for StatusBrasil.** Configuration lives in `biome.json` at the repo root. ESLint, Prettier, and any associated plugins are not installed and must not be added.

Conventions enforced by `biome.json`: double quotes, semicolons always, trailing commas, two-space indent, 100-column lines, organize-imports on save, recommended lint rules. CSS and JSON are formatted with Biome too. The `pnpm ci` script runs `biome ci`, which fails on warnings — useful as a CI gate.

## Consequences

- **Easier:** one config, one dependency, sub-second formatting, identical behaviour in editor and CI. Onboarding a new contributor is a single `pnpm install` plus the Biome editor extension.
- **Harder:** Biome's rule coverage is narrower than the union of ESLint's plugin ecosystem. Biome ships its own `lint/a11y/*` rule set, but it is less comprehensive than `eslint-plugin-jsx-a11y`, and a few specialized React-ecosystem rules have no Biome equivalent — we accept the gap and lean on `axe-playwright` (installed as a dev dependency in `package.json`) for runtime accessibility testing. Editor support outside Biome's official extension is sparser.
- **Committed to:** Biome as the formatting authority, `pnpm format` / `pnpm lint` / `pnpm ci` as the only entry points, and not introducing a parallel ESLint or Prettier pipeline alongside it.
