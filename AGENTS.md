<!--
  Token budget: keep this file ≤ ~150 lines / ~2.5K tokens.
  Depth lives in docs/architecture/*.md and is loaded on demand.
  When in doubt, link out — do not duplicate.
-->

# AGENTS.md — Clean Architecture Compliance Contract (Kernel)

This file is a **hard contract** for any contributor (human or AI) working in this repository. The architecture is the product. If a change violates the rules below, it is wrong, regardless of how convenient it is.

## How to use this file

This kernel is always loaded into agent context. It carries only the rules an agent needs every turn — the dependency rule, the layer cheat-sheet, the naming table, the top forbidden patterns, and pointers. Every section ends with `→ Full: <link>` into [docs/architecture/](./docs/architecture/README.md), where the full discussion lives. Load a module when you need depth on its topic; otherwise, this file is enough.

## 1. The dependency rule (the one rule that cannot bend)

**Source-code dependencies always point inward.** Outer layers know about inner layers; inner layers know nothing about outer layers. **No exceptions.**

```
presentation ──┐                ┌── infrastructure
               ▼                ▼
              application ───► domain
```

| Layer            | Path                            | May import from                                              | Must NOT import from                                     |
| ---------------- | ------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `domain`         | `src/domain/`                   | itself, Node std-lib (rare), TS only                         | application, infrastructure, presentation, any framework |
| `application`    | `src/application/`              | `domain`, itself, TS only                                    | infrastructure, presentation, any framework              |
| `infrastructure` | `src/infrastructure/`           | `domain`, `application`, Node std-lib, framework SDKs        | presentation                                             |
| `presentation`   | `src/presentation/`             | `domain` (only `DomainError`), `application`, framework SDKs | infrastructure (use the composition root instead)        |
| composition root | `src/index.ts`, `src/server.ts` | every layer                                                  | n/a — this is the only place wiring happens              |

→ Full: [docs/architecture/dependency-rule.md](./docs/architecture/dependency-rule.md)

## 2. Layer cheat-sheet

| Layer            | What lives here                                                            | What never lives here                                              |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `domain`         | Entities, VOs, aggregates, domain services, domain errors, events          | I/O, framework, `Date.now()`, `randomUUID()`, `process.env`        |
| `application`    | Use cases + decorators, input/output ports, DTOs, mappers, sagas           | Concrete adapters, framework imports, `console.*`, mutable state   |
| `infrastructure` | Adapters implementing output ports (one tech per file, in-memory mandate)  | Presentation imports, multi-port files, escaping persistence types |
| `presentation`   | CLI / HTTP / queue handlers translating transports ↔ input ports + DTOs    | Business logic, infrastructure imports, domain entities/VOs        |
| composition root | `src/index.ts`, `src/server.ts`, `src/worker.ts` — only place to `new …()` | Business logic, DI containers, `if (process.env.X)` switches       |

→ Full: [docs/architecture/layer-responsibilities.md](./docs/architecture/layer-responsibilities.md)

## 3. Naming at a glance

| Concept              | File suffix / pattern                       | Example                                                        |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Entity / VO          | `<name>.ts`                                 | `domain/user/user.ts`, `domain/user/email.ts`                  |
| Typed id             | `<name>-id.ts`                              | `domain/user/user-id.ts`                                       |
| Domain error         | grouped in `errors.ts` per aggregate        | `domain/user/errors.ts`                                        |
| Domain event         | `events/<name>.ts` (past-tense)             | `domain/order/events/order-cancelled.ts`                       |
| Use case             | `<verb>-<noun>.ts`                          | `application/use-cases/create-user.ts`                         |
| Use-case decorator   | `<adjective>-<verb>-<noun>.ts`              | `application/use-cases/logged-create-user.ts`                  |
| Input port           | `<verb>-<noun>-use-case.ts`                 | `application/ports/input/create-user-use-case.ts`              |
| Output port          | `<noun>.ts`                                 | `application/ports/output/user-repository.ts`                  |
| Read-model port      | `<noun>-read-model.ts`                      | `application/ports/output/user-read-model.ts`                  |
| Output boundary      | `<verb>-<noun>-output.ts`                   | `application/ports/output/create-user-output.ts`               |
| DTO                  | `<noun>-dto.ts`                             | `application/dtos/user-dto.ts`                                 |
| Mapper               | `<noun>-mapper.ts` (camelCase const export) | `application/mappers/user-mapper.ts`                           |
| Adapter              | `<tech>-<port>.ts`                          | `infrastructure/persistence/json-file-user-repository.ts`      |
| Adapter decorator    | `<adjective>-<port>.ts`                     | `infrastructure/persistence/cached-user-repository.ts`         |
| Persistence record   | `<noun>-record.ts`                          | `infrastructure/persistence/user-record.ts`                    |
| Test data builder    | `<noun>-builder.ts`                         | `tests/user/builders/user-builder.ts`                          |
| Architecture test    | `<rule>.arch.test.ts`                       | `tests/architecture/dependency-rule.arch.test.ts`              |

`kebab-case` files, `PascalCase` classes, `camelCase` consts, `SCREAMING_SNAKE_CASE` error codes. Use `#layer/*` import aliases. No barrels, no default exports, no `any`.

→ Full: [docs/architecture/naming-conventions.md](./docs/architecture/naming-conventions.md)

## 4. Top 15 forbidden patterns (PR rejected)

1. ❌ Cross-layer import that violates the dependency rule (`#domain` importing `#application`/`#infrastructure`/`#presentation`, etc.).
2. ❌ Cross-bounded-context domain import (`domain/billing/*` from `domain/user/*` or vice versa).
3. ❌ `import` of a use-case **class** (or domain entity / VO) from `#presentation/*` — depend on the input port and DTOs only.
4. ❌ A `public` constructor on an entity or value object (use a static factory).
5. ❌ Anemic entity: state-only with all logic living in a use case (rich entities own their behavior).
6. ❌ Returning a domain entity or VO from a use case (always map to a DTO).
7. ❌ DTO containing a `Date`, `Map`, `Set`, `BigInt`, class instance, or VO field (primitives only, `readonly`).
8. ❌ Direct `new Date()`, `Date.now()`, `crypto.randomUUID()`, `Math.random()`, `fetch`, `fs.*`, `process`, or `console.*` in `domain/` or `application/`. Inject ports.
9. ❌ Reading `process.env` from anywhere other than `src/config.ts`.
10. ❌ `new <ConcreteAdapter>(...)` outside a composition root, `src/composition.ts`, or a sibling adapter inside `infrastructure/`.
11. ❌ A use case mutating more than one aggregate per call (use domain events or a `UnitOfWork`).
12. ❌ A query use case (`Get…`/`List…`/`Find…`/`Count…`) that mutates state.
13. ❌ A use case named after a noun (`UserService`) instead of an imperative verb-noun (`CreateUser`).
14. ❌ A command that is externally retriable but neither naturally idempotent nor accepts an `idempotencyKey`.
15. ❌ Barrel files (`index.ts` outside `src/index.ts`) or default exports.

→ Full list: [docs/architecture/forbidden-patterns.md](./docs/architecture/forbidden-patterns.md)

## 5. When you need to do X

| I want to…                                | Read this recipe                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Add a new use case                        | [recipes.md#81](./docs/architecture/recipes.md#81-add-a-new-use-case-to-an-existing-aggregate)  |
| Add a new entity / aggregate              | [recipes.md#82](./docs/architecture/recipes.md#82-add-a-new-entity--aggregate)                  |
| Add a new value object                    | [recipes.md#83](./docs/architecture/recipes.md#83-add-a-new-value-object)                       |
| Add a new infrastructure adapter          | [recipes.md#87](./docs/architecture/recipes.md#87-add-a-new-infrastructure-adapter-eg-postgres) |
| Add a new delivery mechanism              | [recipes.md#88](./docs/architecture/recipes.md#88-add-a-new-delivery-mechanism)                 |
| Add a new env var                         | [recipes.md#89](./docs/architecture/recipes.md#89-add-a-new-env-var)                            |
| Add a new domain error code               | [recipes.md#810](./docs/architecture/recipes.md#810-add-a-new-domain-error-code)                |
| Add a use-case decorator                  | [recipes.md#811](./docs/architecture/recipes.md#811-add-a-use-case-decorator)                   |
| Add a domain event                        | [recipes.md#814](./docs/architecture/recipes.md#814-add-a-domain-event)                         |
| Add a saga / process manager              | [recipes.md#815](./docs/architecture/recipes.md#815-add-a-saga--process-manager)                |

→ Full set (20 recipes): [docs/architecture/recipes.md](./docs/architecture/recipes.md)

## 6. Before declaring done

```bash
npm run lint                   # XO + Prettier
npm test -- --run              # Vitest, including architecture tests
```

When in doubt about a boundary, re-read [§1](#1-the-dependency-rule-the-one-rule-that-cannot-bend). If you still have doubt, write an architecture fitness test that fails when the boundary is crossed.

→ Full: [docs/architecture/verification.md](./docs/architecture/verification.md)

## 7. Module index

- [docs/architecture/glossary.md](./docs/architecture/glossary.md) — tactical, strategic, and test vocabulary.
- [docs/architecture/dependency-rule.md](./docs/architecture/dependency-rule.md) — dependency rule, SOLID, component principles, boundary anatomy.
- [docs/architecture/layer-responsibilities.md](./docs/architecture/layer-responsibilities.md) — per-layer responsibilities, forbidden imports, composition-root rules.
- [docs/architecture/domain-modeling.md](./docs/architecture/domain-modeling.md) — entities, VOs, aggregates, services, errors, events, factories, supple design.
- [docs/architecture/application.md](./docs/architecture/application.md) — use cases, validation tiers, errors, idempotency, decorators, DTOs, mappers, output boundary.
- [docs/architecture/ports-adapters.md](./docs/architecture/ports-adapters.md) — port conventions, repositories, in-memory mandate, ACL, out-of-scope patterns.
- [docs/architecture/cross-cutting.md](./docs/architecture/cross-cutting.md) — logging, time/identity, config, auth, inter-context, sagas, observability, resilience, secrets, i18n, migration.
- [docs/architecture/naming-conventions.md](./docs/architecture/naming-conventions.md) — full naming table + TypeScript and project-wide conventions.
- [docs/architecture/recipes.md](./docs/architecture/recipes.md) — 20 step-by-step "I want to…" recipes.
- [docs/architecture/forbidden-patterns.md](./docs/architecture/forbidden-patterns.md) — full list of patterns that fail review.
- [docs/architecture/testing.md](./docs/architecture/testing.md) — layer strategies, the test pyramid, conventions, contract tests, fitness functions.
- [docs/architecture/verification.md](./docs/architecture/verification.md) — exact commands to run before declaring done.
- [docs/architecture/adr-process.md](./docs/architecture/adr-process.md) — when and how to record an architectural decision.
- [docs/architecture/reading-list.md](./docs/architecture/reading-list.md) — canonical sources behind the rules.
