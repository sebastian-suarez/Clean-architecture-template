# Forbidden patterns (PR will be rejected)

The complete list of patterns that fail review. The kernel `AGENTS.md` carries the top 15 inline; this is the full enumeration grouped by category. Every entry here corresponds to a rule stated elsewhere — when in doubt, follow the cross-reference back to the rule.

## Layer boundaries

- ❌ `import` of `#infrastructure/*` from `#application/*` or `#domain/*`.
- ❌ `import` of `#presentation/*` from anywhere except a composition root.
- ❌ `import` of a use-case **class** from `#presentation/*` (depend on the input port instead).
- ❌ `import` of a domain entity / VO from `#presentation/*` (DTOs only; `DomainError` is the sole exception).
- ❌ A "shared utils" bag of mixed-layer code. Every helper belongs to exactly one layer.
- ❌ Cross-bounded-context import (`domain/billing/*` from `domain/user/*` or vice versa) — see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication).
- ❌ A cycle between bounded contexts (ADP — see [dependency-rule.md](./dependency-rule.md#13-component-principles-uncle-bob-part-iv)).
- ❌ Barrel files (`index.ts` re-exports). Import from the source file (see [naming-conventions.md](./naming-conventions.md#71-typescript-specific-conventions)).
- ❌ A DI/IoC container library wiring concrete classes outside the composition root.

## Domain modeling

- ❌ A `public` constructor on an entity or value object (use a static factory).
- ❌ A non-`readonly` field on an entity or value object.
- ❌ A setter or mutating method that bypasses the entity's invariant checks.
- ❌ Equality of value objects via `===` instead of `.equals()`.
- ❌ Reaching into a non-root entity of an aggregate from outside the aggregate.
- ❌ An anemic entity: a class with only `readonly` fields and no behavior, where every state change happens in a use case via `User.create({...oldUser, status: "X"})`.
- ❌ Returning a mutable inner-entity reference from an aggregate root.
- ❌ Re-running creation invariants inside `reconstruct()` (see [domain-modeling.md](./domain-modeling.md#31-entities)).
- ❌ A repository / use case that touches more than one aggregate transactionally (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)).
- ❌ An aggregate holding a direct reference to another aggregate (hold an id — Vernon Rule 3).
- ❌ A domain service that depends on an output port (see [domain-modeling.md](./domain-modeling.md#34-domain-services)).
- ❌ A domain event whose name is present-tense (`OrderCancelling`) or imperative (`CancelOrder`). Events are past-tense facts (see [domain-modeling.md](./domain-modeling.md#36-domain-events)).
- ❌ An aggregate publishing a domain event directly. The use case dispatches buffered events (see [domain-modeling.md](./domain-modeling.md#36-domain-events)).
- ❌ Side-effecting code inside a VO method (Evans's side-effect-free functions — see [domain-modeling.md](./domain-modeling.md#39-supple-design-evans-part-iii)).

## Application

- ❌ A use case returning a domain entity or value object.
- ❌ A use case holding state across calls (no mutable instance fields).
- ❌ A use case named after a noun (`UserService`) rather than an imperative (`CreateUser`).
- ❌ A query use case (`Get…` / `List…` / `Find…` / `Count…`) that mutates state.
- ❌ Direct `new Date()`, `randomUUID()`, `fetch(...)`, `fs.*`, `console.*` inside a use case or domain object.
- ❌ Service-locator or global registry lookup of dependencies inside a use case (constructor injection only).
- ❌ `Result<T, E>` / `Either` return types from use cases (we throw `DomainError`).
- ❌ A DTO containing a `Date`, `Map`, `Set`, `BigInt`, class instance, or VO field.
- ❌ A non-`readonly` field on a DTO, or a method on a DTO.
- ❌ Renaming or removing a published DTO field without a deprecation cycle.
- ❌ A mapper that performs I/O, calls `new Date()` / `randomUUID()`, or returns `undefined` to mean "couldn't map".
- ❌ Inlining cross-cutting concerns (logging, tracing, auth, transactions, retries, caching) inside a use case instead of a decorator (see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)).
- ❌ A command that is not idempotent and provides no idempotency key (see [application.md](./application.md#44-idempotency-and-retries)).
- ❌ A use case that reads a feature flag directly to choose between behaviors (see [cross-cutting.md](./cross-cutting.md#69-caching-rate-limiting-multi-tenancy-audit-feature-flags)). Flags are wiring.
- ❌ A use case that reads `process.env` (see [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts)).
- ❌ Mixing return-DTO and Output Boundary styles within the same use case (see [application.md](./application.md#48-output-boundary-presenter-port)).

## Configuration

- ❌ Reading `process.env` from anywhere other than `src/config.ts`.
- ❌ A secret, password, or API key checked into source, fixtures, or `.env.example`.
- ❌ Logging a secret-bearing field anywhere (use cases, mappers, error handlers, route logs).

## Infrastructure

- ❌ A repository method named in tech-speak (`runQuery`, `selectAll`).
- ❌ A repository that returns a persistence-shaped record (always return entities).
- ❌ Letting a persistence record type escape the `infrastructure/persistence/` directory (no imports from `application/`, `domain/`, or `presentation/`).
- ❌ Adding a new output port without a paired in-memory adapter.
- ❌ Adapter logging via `console.*` directly when a `Logger` port exists in the codebase.
- ❌ A repository read method that returns an unbounded list on a production-scale dataset, with no paginated alternative.
- ❌ A `save` that silently overwrites a stale version when the aggregate carries a `version` field (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)).
- ❌ A naked outbound network call without timeout, retry, or circuit-breaker policy (see [cross-cutting.md](./cross-cutting.md#68-resilience)).
- ❌ Mixing two technologies in one adapter file (see [layer-responsibilities.md](./layer-responsibilities.md#23-infrastructure-srcinfrastructure) — one port per file, one technology per file).

## Presentation

- ❌ Business logic in an HTTP route, CLI command, or repository.
- ❌ `if`/`switch` on `error.constructor.name` — match on `error instanceof DomainError` and dispatch on `error.code`.
- ❌ Renaming or removing a `DomainError` `code` (only new codes may be added).
- ❌ A presentation file importing a use-case **class** instead of its input port.
- ❌ A presentation file importing a domain entity or VO for response shaping (DTOs only).
- ❌ Trusting a transport-level claim (e.g., a JWT) without verifying it via an auth adapter (see [cross-cutting.md](./cross-cutting.md#64-authentication--authorization)).

## Composition root

- ❌ `new <ConcreteAdapter>(...)` outside `src/<delivery>.ts`.
- ❌ Business logic in a composition root (see [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts)).
- ❌ A separate "DI container" module that other layers import.
- ❌ `if (process.env.X)` switches in the composition root that go beyond what `loadConfig()` returned.

## Testing

- ❌ A `domain/` test that imports infrastructure or boots a server (see [testing.md](./testing.md#101-layer-specific-test-strategies)).
- ❌ A test calling itself a "Mock" when it's actually a Fake/Stub (Meszaros — see [glossary.md](./glossary.md#test-terms-meszaros)).
- ❌ A test that relies on real time (`new Date()`) or real randomness inside the unit under test — inject port doubles.
- ❌ A test that doesn't isolate state between cases (shared module-level mutable state across `it` blocks).
- ❌ A presentation-layer test importing a real use-case class (mock the input port).
- ❌ Adding a second adapter for an existing output port without extending the contract test (see [testing.md](./testing.md#104-contract-tests-for-adapters)).

---

**See also:** [dependency-rule.md](./dependency-rule.md) · [layer-responsibilities.md](./layer-responsibilities.md) · [naming-conventions.md](./naming-conventions.md) · [testing.md](./testing.md)
