# Architecture Decision Records (ADR)

Numbered, immutable decision logs for significant `@tgoliveira/vault-core` design choices.

## Format

Each ADR follows this structure:

| Section | Purpose |
| --- | --- |
| **Status** | `Proposed`, `Accepted`, `Deprecated`, or `Superseded` |
| **Date** | Decision date (ISO 8601) |
| **Context** | Problem, constraints, and forces |
| **Decision** | What we chose and why |
| **Consequences** | Positive, negative, and follow-up work |
| **References** | Related docs, issues, and code |

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](./0001-emergency-duress-mode.md) | Emergency / Duress Mode | Accepted |

## When to write an ADR

- New public API surface or crypto protocol extension
- Security-boundary changes (session, envelopes, persistence contracts)
- Cross-package features that split vault-core vs consumer responsibilities

Trivial bug fixes and internal refactors do not need an ADR.
