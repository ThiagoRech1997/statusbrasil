# Contributing to StatusBrasil

Thanks for taking the time to contribute. This document covers the local dev workflow, commit conventions, and the sign-off required for every patch.

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

Prerequisites:
- Node ≥22
- pnpm 10.33.0 (run `corepack enable` once and pnpm will be provisioned automatically from `package.json`'s `packageManager` field)

```bash
git clone https://github.com/ThiagoRech1997/statusbrasil.git
cd statusbrasil
pnpm install
pnpm dev
```

The dev server runs at [http://localhost:3000](http://localhost:3000). The default locale is `pt`; English is at `/en`.

## Verifying your change

Before opening a PR, all of these must pass locally — they are also gates in CI:

```bash
pnpm lint        # Biome check (formatting + linting)
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest unit tests
node scripts/i18n-drift.mjs   # pt/en key parity
```

If you touched UI, smoke-test in a browser and run the relevant route through axe (see `tests/e2e/` for examples).

## Adding a translation key

`messages/pt.json` is the canonical source; `messages/en.json` mirrors its structure. Whenever you add a user-facing string, add the key to **both** files. CI fails on key drift.

## Commit conventions

- Subject line is in **English**, written as a descriptive imperative (e.g. `Add CSP nonce middleware`, `Fix locale fallback for /api routes`).
- **Do not** prefix with a ticket identifier (no `TFR-XXX:`, no `[#123]`). Issue links belong in the PR description, not in git history.
- **Do not** add `Co-Authored-By:` or other co-authorship trailers.
- One logical change per commit. If a refactor and a feature need to land together, that is OK; a refactor mixed with unrelated cleanup is not.

### Developer Certificate of Origin (DCO)

Every commit must be signed off, certifying that you wrote the patch (or otherwise have the right to submit it under the project's license). Sign off by adding a `Signed-off-by` trailer with `git commit -s`:

```
Add CSP nonce middleware

Signed-off-by: Your Name <you@example.com>
```

The full DCO text is at <https://developercertificate.org>. CI rejects unsigned commits from external contributors.

## Pull request workflow

1. Fork the repo (external contributors) or create a topic branch (maintainers).
2. Make focused commits following the conventions above.
3. Push and open a PR against `main`. The PR template will prompt for the verifications you ran.
4. Address review feedback by adding new commits — do not force-push over review history unless asked.
5. Once CI is green, a maintainer merges via squash or rebase (linear history is required on `main`).

## Branch protection on `main`

The `main` branch is protected. Every change must land through a pull request that satisfies the rules below; direct pushes from a clone are rejected.

- The `ci` status check (lint, typecheck, unit tests, i18n drift) must pass before the merge button is enabled.
- A **linear history** is required — only squash or rebase merges are accepted, no merge commits.
- Force pushes to `main` and deletion of `main` are blocked.
- Reviewer approvals are **not required** (this is a solo project today). The PR flow exists so CI gates every commit on `main`, not for a four-eyes check.

Admin enforcement is intentionally left off (`enforce_admins: false`) so the maintainer can break-glass during incident response. Day-to-day work — including maintainer work — still goes through the PR flow above.

## Reporting bugs and proposing features

Open an issue using the [bug](.github/ISSUE_TEMPLATE/bug.md) or [feature](.github/ISSUE_TEMPLATE/feature.md) template. Security-sensitive issues should be reported privately to <thiagorech.1997@gmail.com> instead of filing a public issue.

## License

By contributing, you agree that your contributions will be licensed under the project's [AGPL-3.0 license](LICENSE).
