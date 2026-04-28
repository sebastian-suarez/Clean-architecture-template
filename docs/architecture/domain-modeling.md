# Domain modeling rules

Tactical DDD applied to TypeScript. This module covers entities, value objects, aggregates and aggregate roots, domain services, errors, events, transactional rules, factories, and Evans's Supple Design patterns. Everything here lives under `src/domain/<context>/` — no I/O, no framework, no `Date.now()`.

## 3.1 Entities

- Have a stable identity. Use a **typed id value object** (`UserId`, `OrderId`) rather than a bare `string`. Typed ids prevent silent argument swaps (`get(orderId, userId)` vs `get(userId, orderId)`) and document intent at call sites. The id VO wraps a `string` (or UUID/ULID) and is generated via the `IdGenerator` port (see [cross-cutting.md](./cross-cutting.md#62-time-and-identity)). The template's `User` uses a bare `string` for brevity — production bounded contexts should upgrade to a typed id (recipe in [recipes.md](./recipes.md#84-add-a-typed-id-upgrade-from-string)).
- All fields `readonly`. State changes either produce a new instance or are applied through behavior methods that validate invariants before reconstruction.
- Use a **private constructor** plus a **static `create(props): Entity`** factory. A separate `reconstruct(props)` static must exist for hydration from persistence. The `constructor` is never `public`.
- **`create` vs `reconstruct`.** `create(props)` runs all creation invariants ("a new order must have at least one line item"). `reconstruct(props)` rehydrates from persistence and must **not** re-run creation-only invariants — past data may have been valid under older rules, and refusing to load it would brick the system. `reconstruct` still validates structural shape (types, non-null fields). Persistence adapters always go through `reconstruct`, never `create`.
- Behavior methods are named in business terms (`order.cancel()`, not `order.setStatusCancelled()`).
- **Rich, not anemic.** Entities encapsulate state _and_ behavior. If an entity is a bag of getters/setters with all logic living in a use case or "service", that's a transaction-script smell — push the logic onto the entity. Behavior that mutates the entity validates invariants before producing the new state.
- Equality is by `id`; the language doesn't enforce this, so compare ids (or id VOs via `.equals`) explicitly.
- **Tell, don't ask** (see [dependency-rule.md](./dependency-rule.md#14-other-named-principles-applied-throughout)) — methods on the entity should _do_ the work, not expose state for the caller to inspect-and-decide.

## 3.2 Value objects

- Fully immutable: `readonly` fields, no setters, no mutating methods.
- Equality is by structural value, exposed via an `equals(other)` method.
- **Self-validating**: invalid input throws a `DomainError` from the static factory. Public constructor is forbidden.
- One concept per VO. `Email`, `Money`, `DateRange` are VOs; "an object that holds five unrelated primitives" is not.
- Implement `toString()` when serialization to a single string is meaningful.
- **Closure of operations** (Evans): when a VO operation returns the same type (`money.add(other) → Money`, `dateRange.intersect(other) → DateRange`), prefer that signature. It composes cleanly and keeps the operation inside the model.
- **Side-effect-free functions** (Evans): VO methods that compute new VOs must not mutate `this` and must not perform I/O. They are pure.
- For typed primitives (`UserId(string)`), prefer a full VO when the value has invariants to enforce (length, format, charset). Use a **branded type** (see [glossary.md](./glossary.md#tactical-in-the-code-terms)) only when the value is opaque, validated once at the boundary, and never compared structurally past that point.

## 3.3 Aggregates and aggregate roots

- An aggregate is a cluster of entities + VOs treated as a single consistency unit.
- Exactly one entity is the **aggregate root**. External code references the root by id; the root grants access to inner members through methods.
- One **repository** per aggregate root (see [ports-adapters.md](./ports-adapters.md#52-repository-rules)). Inner entities have no repository of their own.
- All invariants of the aggregate are enforced by the root: changes to inner entities go through methods on the root.

**Vernon's four aggregate design rules** (apply in this order):

1. **Model true invariants in consistency boundaries.** An aggregate exists to enforce a rule that _must_ be true after every operation ("an order's total equals the sum of its line items"). If there is no such rule, you don't need an aggregate — you have two independent entities.
2. **Design small aggregates.** Prefer many small aggregates over one big one. Large aggregates lock more rows, fail more concurrent writes, and tempt cross-cutting reads. If your `save` writes thousands of rows, split the aggregate.
3. **Reference other aggregates by identity only.** Never hold an `OtherAggregate` reference inside an aggregate; hold an `OtherAggregateId`. The use case loads the other aggregate (or its read model) explicitly when needed. This keeps each aggregate a self-contained transactional unit.
4. **Use eventual consistency outside the boundary.** Cross-aggregate effects happen through domain events or an explicit `UnitOfWork`, not through one transaction that touches both. A use case mutates **at most one aggregate per call** (see §3.7).

## 3.4 Domain services

- **Stateless.** No fields, only methods (or just exported pure functions).
- Live in `src/domain/<context>/services/<name>.ts`.
- Take entities/VOs as arguments, return entities/VOs or domain primitives.
- Use a domain service only when the behavior crosses multiple entities and doesn't naturally belong on any one of them. Reaching for a service for single-entity logic is a smell — put it on the entity.
- Distinct from a use case: a domain service is a pure domain operation; a use case is a transaction/orchestration. Domain services may be called by use cases or by other domain code; use cases are called only from presentation.
- A domain service must not depend on output ports — it stays pure. If it needs I/O, it's a use case in disguise.

## 3.5 Domain errors

- Extend `DomainError` (in `src/domain/shared/domain-error.ts`).
- Expose a stable `code: string` getter. **The `code` is part of the public API.** Renaming a code is a breaking change to every consumer (HTTP status mapping, CLI exit messages, alerts). Only add new codes; never rename or remove.
- Codes are SCREAMING_SNAKE_CASE strings (`USER_NOT_FOUND`, `INVALID_EMAIL`).
- Group errors per aggregate in `errors.ts`.
- Throw domain errors directly from VO factories, entity methods, and use cases. Catch only at the presentation boundary.
- Error messages describe the **business outcome**, never the underlying credential, secret, or technical detail. "Invalid email" — not "regex /^…$/ failed against value 'abc'".
- User-supplied input may appear in error messages (so the user can see what they typed); internal identifiers, query strings, and stack frames may not.

## 3.6 Domain events

The template ships a worked example. The Order aggregate buffers events in `src/domain/order/events/` (`OrderPlaced`, `OrderConfirmed`, `OrderCancelled`, `LineItemAdded`); use cases (`PlaceOrder`, `ConfirmOrder`, `CancelOrder`) dispatch them via the `EventPublisher` port (`src/application/ports/output/event-publisher.ts`) after `repository.save`. The `InMemoryEventPublisher` adapter delivers to in-process subscribers (the saga and the projector — see [cross-cutting.md](./cross-cutting.md#66-sagas--process-managers) and [application.md](./application.md#41-use-case-granularity-naming-cqs-cqrs)).

- Events are **past-tense facts**: `OrderCancelled`, `UserRegistered`. Never `OrderCancelling` or `RegisterUser`.
- Events live in `src/domain/<context>/events/<name>.ts` as plain immutable types — same rules as DTOs (primitives only, `readonly`, serializable).
- An aggregate's mutating method records an event in a private buffer (`this.events.push(...)`); the use case dispatches the buffered events at the end of its execution via an injected `EventPublisher` output port. **Entities never publish events directly.**
- Event delivery is **at-least-once** by default. Subscribers are idempotent (see [application.md](./application.md#44-idempotency-and-retries)).
- Subscribers are registered in the composition root.
- Events are part of the bounded context's published language when consumed across contexts (see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)). Renaming or restructuring an externally-consumed event is a breaking change.

## 3.7 Aggregate transactional rules

- **Atomic load–mutate–save.** A use case loads an aggregate, mutates it, and persists it as one transactional unit. Partial saves of an aggregate are forbidden — repositories take and return the whole root.
- **One aggregate, one transaction.** A single use case touches at most one aggregate transactionally (see §3.3). Cross-aggregate effects happen via eventual consistency (domain events) or an explicit `UnitOfWork` port (see [ports-adapters.md](./ports-adapters.md#55-out-of-scope-by-default)). Reaching for a multi-aggregate transaction is almost always a sign that the aggregate boundaries are wrong.
- **Optimistic concurrency.** When an aggregate may be edited concurrently, give the root a `version: number` and have the repository's `save` reject stale writes by throwing `ConcurrencyError extends DomainError` (`code: "CONCURRENT_UPDATE"`). The in-memory adapter must implement this check too — otherwise tests pass against a model production cannot satisfy.
- **Keep aggregates small** (Vernon Rule 2 — see §3.3). Aggregates exist to enforce invariants, not to model "everything related to a noun."
- **No leaking inner state.** External code mutates the aggregate only through methods on the root (see §3.3). Returning a mutable inner-entity reference is a bug; return copies, immutable views, or expose query methods (`order.lineItem(id): LineItemView`).

## 3.8 Factories

- Use a **factory** when entity construction needs collaborators that don't belong as fields — e.g., a clock, an id generator, or a lookup against another aggregate to validate a foreign-key invariant.
- A factory is preferred over an enormous `static create(props)` whose `props` smuggle in services. Concretely: when `create` would need 5+ unrelated arguments, extract a factory.
- Two flavors:
  - **Domain factory** — pure; no I/O. Lives at `src/domain/<context>/factories/<name>-factory.ts`. Used when construction needs domain logic but no side effects.
  - **Application factory** — depends on output ports. Lives at `src/application/factories/<name>-factory.ts`. Injected into use cases the same way ports are.
- A factory still produces aggregates via the entity's `static create` (see §3.1). It does not bypass invariants.
- Don't introduce a factory speculatively. Default to `static create(props)`; promote to a factory when the construction signature gets noisy (YAGNI — see [dependency-rule.md](./dependency-rule.md#14-other-named-principles-applied-throughout)).

## 3.9 Supple Design (Evans, Part III)

Patterns to apply when refactoring the domain toward expressive, low-friction code:

- **Intention-Revealing Interfaces** — Method names describe _what_ and _why_ in domain terms, not _how_. `order.cancel(reason)` over `order.updateStatus(3)`.
- **Side-Effect-Free Functions** — Operations that return new values (especially on VOs) must not mutate; commands that mutate must not return derived values. Don't combine.
- **Assertions** — Invariants are checked at the point they apply (in entity methods, in VO factories) and stated in tests. The code says what's true after each operation.
- **Conceptual Contours** — Carve modules along the natural fault lines of the domain. If a change consistently touches two files, they're miscarved.
- **Standalone Classes** — A class with no dependencies on other domain classes is the easiest to reason about. Prefer self-contained VOs where you can.
- **Closure of Operations** — When `f(T) → T` is possible, prefer it. It composes (`a.add(b).add(c)`).
- **Declarative Design** — Express _what_ should be true, not _how_ to make it true. Specifications (see [ports-adapters.md](./ports-adapters.md#55-out-of-scope-by-default)) are an example; rule DSLs are another. Don't invent a DSL prematurely (YAGNI).

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [application.md](./application.md) · [ports-adapters.md](./ports-adapters.md) · [recipes.md](./recipes.md)
