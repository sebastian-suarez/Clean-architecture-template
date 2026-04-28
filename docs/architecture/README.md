# Architecture modules

`AGENTS.md` is a lean kernel intentionally kept under ~2.5K tokens. The depth lives here, in topic-scoped modules that are loaded on demand by an agent or read by a human.

Each module is the authoritative source for its topic. The kernel summarizes; these files explain.

## Modules

- [Glossary](./glossary.md) — tactical, strategic, and test vocabulary.
- [Dependency rule & architectural principles](./dependency-rule.md) — the one rule that cannot bend, plus SOLID, component principles, and boundary anatomy.
- [Layer responsibilities](./layer-responsibilities.md) — what lives in `domain/`, `application/`, `infrastructure/`, `presentation/`, and the composition root.
- [Domain modeling](./domain-modeling.md) — entities, value objects, aggregates, services, errors, events, factories, supple design.
- [Application layer](./application.md) — use case granularity, validation tiers, error handling, idempotency, decorators, DTOs, mappers, output boundary.
- [Ports & adapters](./ports-adapters.md) — port conventions, repositories, the in-memory mandate, ACL, out-of-scope patterns.
- [Cross-cutting concerns](./cross-cutting.md) — logging, time/identity, config, auth, inter-context communication, sagas, observability, resilience, caching/rate-limit/audit/flags, secrets, i18n, migration patterns.
- [Naming & file conventions](./naming-conventions.md) — the naming table and TypeScript-specific conventions.
- [Recipes](./recipes.md) — step-by-step "I want to do X" instructions with code skeletons.
- [Forbidden patterns](./forbidden-patterns.md) — full list of patterns that fail review.
- [Testing](./testing.md) — layer strategies, the test pyramid, conventions, contract tests, fitness functions.
- [Verification](./verification.md) — exact commands to run before declaring done.
- [ADR process](./adr-process.md) — when and how to record an architectural decision.
- [Reading list](./reading-list.md) — canonical sources behind the rules.
