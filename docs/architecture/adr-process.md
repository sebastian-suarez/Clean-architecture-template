# Architecture Decision Records

ADRs record the _why_ behind architectural decisions. The kernel and the rest of the docs describe the _what_; the ADR captures the reasoning so future contributors can revisit a decision instead of inheriting it as folklore.

When this contract changes, the change is recorded in `docs/adr/<NNNN>-<slug>.md` using the standard ADR format:

- **Status** — proposed / accepted / superseded by ADR-XXXX
- **Context** — what forced the change
- **Decision** — what we agreed to
- **Consequences** — what becomes easier and what becomes harder

ADRs are append-only. A reversal is a new ADR that supersedes the old; the old stays in the file. AGENTS.md is updated to match the latest accepted ADRs — the ADR is the _why_, AGENTS.md is the _what_.

Use an ADR for anything that:

- Adds, removes, or changes a layer / port convention.
- Adopts an out-of-scope pattern (CQRS, event sourcing, sagas, specifications, UoW, shared kernel).
- Changes a context-map relationship (see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)).
- Introduces a new cross-cutting concern (caching, multi-tenancy, audit, …).

Don't write an ADR for a single bug fix or a normal feature — only for decisions that future contributors need the _reasoning_ behind to revisit.

---

**See also:** [verification.md](./verification.md) · [reading-list.md](./reading-list.md)
