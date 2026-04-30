# Architecture Decision Records

This directory holds Architecture Decision Records (ADRs) for StatusBrasil. An ADR captures a significant technical decision, the context that drove it, and its consequences — so that future contributors can understand *why* the codebase looks the way it does, not just *what* it does.

## Format

Each ADR is a single Markdown file named `NNNN-short-title.md` (zero-padded, monotonically increasing). Use the template below.

```markdown
# NNNN. Short, descriptive title

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD

## Context

What problem are we solving? What constraints, prior decisions, or external forces are in play?

## Decision

The decision, stated as a single declarative sentence. Then a short paragraph elaborating on what we are doing and how.

## Consequences

What becomes easier, what becomes harder, what we are now committed to, and what we explicitly accept as trade-offs.
```

## Conventions

- Once an ADR is **Accepted**, do not edit it in place. Supersede it with a new ADR that references the old one and flip the old one to **Superseded by ADR-XXXX**.
- Keep ADRs short. If you need more than two screens, split the decision.
- Link to ADRs from `README.md` and `AGENTS.md` whenever a future reader would benefit from the rationale.
