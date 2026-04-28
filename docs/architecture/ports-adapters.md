# Ports & adapters rules

Ports are the symmetric boundary between the application and the outside world: driving (input) ports describe what the application does, driven (output) ports describe what the application needs. Adapters in `presentation/` and `infrastructure/` plug into them. This module also covers repository conventions, the in-memory adapter mandate, the Anti-Corruption Layer, and patterns that are out of scope by default.

## 5.1 Port conventions

- Ports come in two families (Cockburn):
  - **Driving (input) ports** — `application/ports/input/`. The outside world calls _into_ the application through these. The use case `implements` them.
  - **Driven (output) ports** — `application/ports/output/`. The application calls _out_ through these. Adapters in `infrastructure/` `implement` them.
- The architecture is **symmetric**: both sides cross the boundary through ports, and both kinds of adapter are replaceable plug-ins.
- Every output-port method that touches I/O returns `Promise<T>`, even if a particular adapter is sync. This keeps adapters substitutable without rewriting use cases.
- Synchronous-by-nature ports may stay sync (`Clock.now(): Date`, `IdGenerator.next(): string`).
- Ports are **narrow** (ISP): each represents a single concern. Don't bundle unrelated methods on a single port (`UserRepository` is for persistence; don't add `sendEmail()` to it).
- Ports use **domain types** in their signatures, never persistence-shaped records.
- Output ports are TypeScript `type`s (or `interface`s); they are not classes. Adapters use `implements` to satisfy them.
- An input port is a TypeScript `type` describing the use case's `execute` signature. The use case `implements` it.

## 5.2 Repository rules

- One repository per aggregate root.
- Methods are expressed in **domain terms** (`findActiveSubscribersBefore(date)`), not technology terms (`runQuery("SELECT …")`).
- Always return aggregate roots (entities) or arrays thereof — never partial records, never persistence rows, never query-builder objects.
- Read methods may take VO parameters (`findByEmail(email: Email)`).
- Delete methods take the id of the root: `delete(id: UserId)`.
- `save(user)` is upsert by default — creates if absent, updates otherwise. Split into `create` / `update` only when the distinction is part of the domain.
- Persistence adapters use a record type + a mapper (`<noun>-record.ts`). The record type lives in `infrastructure/persistence/` and may be shared within that directory (mappers, adjacent adapters), but **must not** be imported from `application/`, `domain/`, or `presentation/`. If a presentation layer needs persistence-shaped data, it's a missing read-model — not an excuse to leak the record.
- **No unbounded queries on production-scale data.** Repository read methods must either be naturally bounded (`findById`, `findByEmail`) or accept an explicit pagination contract:

  ```ts
  type Page<T> = {
  	readonly items: readonly T[];
  	readonly nextCursor: string | undefined;
  };
  type Pagination = { readonly cursor?: string; readonly limit: number }; // limit ∈ [1, 100]
  ```

  `findAll(): Promise<User[]>` is acceptable in this template only because the dataset is small and the boundary case is "in-memory test fixture." A production repository must offer a paginated alternative; if both exist, the unbounded one should be commented as test-only.

- **Optimistic concurrency** (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)): if the aggregate carries a `version`, the repository's `save` rejects stale writes with `ConcurrencyError`. Every adapter — including in-memory — implements this consistently.
- **Read model ports** are _not_ repositories — they return DTOs and may be backed by a denormalized projection. Don't bend a repository to serve query DTOs (see [application.md](./application.md#41-use-case-granularity-naming-cqs-cqrs)).

## 5.3 In-memory adapter is mandatory

For every output port, an in-memory adapter must exist alongside any production adapter. It serves as:

- The default test double for application tests.
- A reference implementation that any other adapter must behave equivalently to (verified by [contract tests](./testing.md#104-contract-tests-for-adapters)).

When you add a new output port, add the in-memory adapter in the same PR.

## 5.4 Anti-Corruption Layer (ACL)

When integrating a foreign system whose model conflicts with the domain (legacy API, third-party SaaS, vendor SDK):

- Place the integration in `src/infrastructure/<concern>/<vendor>-<port>.ts`.
- Translate the foreign model to the domain model **inside the adapter**. The application and domain layers must never see foreign types.
- If the translation is non-trivial, extract a private mapper. If the integration grows, isolate it in a subfolder (e.g. `infrastructure/billing/stripe/`).
- The ACL is the implementation of the **Anticorruption Layer** context-mapping pattern (see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)) at the infrastructure boundary.

## 5.5 Out of scope by default

These DDD/CA-adjacent patterns are not used in this template. If you need one, follow the convention below; don't invent a new one.

- **Specifications** — A `Specification<T>` is a reusable predicate object (`new ActiveUserSpec().and(new SignedUpAfterSpec(date))`). Useful when (a) the same predicate appears in multiple places, (b) predicates compose freely, (c) the persistence layer can translate the spec to a query. **Prefer adding a domain-named repository method (`findActiveBefore`)** over a generic `find(spec)`. Adopt specifications when the predicate matrix grows past ~5 named methods.
- **Unit of Work** — Define a `UnitOfWork` output port; have infrastructure coordinate the transaction; use cases call `unitOfWork.run(async () => …)`. Never leak transaction objects into the application layer. Used when a single use case must update an aggregate _and_ an idempotency record (or similar) atomically.
- **Event Sourcing** — see [application.md](./application.md#41-use-case-granularity-naming-cqs-cqrs).

Patterns that ship as worked examples (no longer "out of scope"):

- **Domain events** — see [domain-modeling.md](./domain-modeling.md#36-domain-events) (`Order` aggregate, `EventPublisher` port).
- **Sagas / process managers** — see [cross-cutting.md](./cross-cutting.md#66-sagas--process-managers) (`OrderConfirmationSaga`, `OrderProcess` aggregate).
- **CQRS read-side projections** — see [application.md](./application.md#41-use-case-granularity-naming-cqs-cqrs) (`OrderSummaryProjector`, `OrderSummaryReadModel`, `ListOrderSummaries`).

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [application.md](./application.md) · [cross-cutting.md](./cross-cutting.md) · [testing.md](./testing.md) · [recipes.md](./recipes.md)
