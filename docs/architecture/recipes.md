# Recipes

Step-by-step instructions for the most common modifications. Each recipe is a sequence of small steps; deviations are allowed only with explicit reasoning recorded in the PR description (or an [ADR](./adr-process.md) when the deviation crystallizes into a new convention).

## 8.1 Add a new use case to an existing aggregate

1. Define the input port at `src/application/ports/input/<verb>-<noun>-use-case.ts`.
2. Implement the use case at `src/application/use-cases/<verb>-<noun>.ts` — `implements` the input port, returns a DTO (or accepts an Output Boundary — see [application.md](./application.md#48-output-boundary-presenter-port)), no shared state.
3. Wire it in every composition root that should expose it (wrap in decorators where needed — see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)).
4. Add a presentation entrypoint depending on the input port.
5. Test the use case with the in-memory adapter and hand-rolled port doubles.

## 8.2 Add a new entity / aggregate

1. Create `src/domain/<aggregate>/` with the entity (private ctor + static `create` + static `reconstruct`), value objects, typed id (see [domain-modeling.md](./domain-modeling.md#31-entities)), and `errors.ts`.
2. Define an output port `src/application/ports/output/<aggregate>-repository.ts`.
3. Add the **in-memory** adapter (mandatory) plus any production adapter (with a mapper).
4. Add a DTO and a mapper.
5. Add use cases as in 8.1.

## 8.3 Add a new value object

1. Create `src/domain/<context>/<name>.ts`.
2. Private constructor, `static create(raw): Name` factory that throws a `DomainError` on invalid input.
3. `equals(other: Name): boolean` for structural equality.
4. `toString()` if a single-string serialization is meaningful.
5. Add a domain error to `errors.ts` (e.g. `InvalidEmailError`).
6. Test the VO directly: valid input round-trips, every invalid shape throws, equality is structural.

## 8.4 Add a typed id (upgrade from `string`)

1. Create `src/domain/<context>/<noun>-id.ts` as either a VO (preferred when there's format validation) or a branded type (`type UserId = string & { readonly __brand: "UserId" }`).
2. Update the entity's `id` field type and any port methods (`findById(id: UserId)`).
3. Update the `IdGenerator` adapter to return the branded type (a small cast at the adapter boundary is fine — that's where the brand is applied).
4. Update DTOs to keep emitting `string` (DTOs are primitives only — see [application.md](./application.md#46-dto-contract)); the brand stays inside the domain.
5. Update tests / builders.

## 8.5 Add a domain service

1. Create `src/domain/<context>/services/<name>.ts` as exported pure functions (preferred) or a stateless class.
2. The service takes entities/VOs as args, returns entities/VOs or domain primitives. No I/O, no ports.
3. Test it directly with in-memory fixtures (built via [testing conventions](./testing.md#103-conventions) builders).

## 8.6 Add a domain factory

1. Decide: domain factory (no I/O) or application factory (depends on output ports).
2. Domain: `src/domain/<context>/factories/<name>-factory.ts`. Application: `src/application/factories/<name>-factory.ts`.
3. The factory still produces aggregates via the entity's `static create` — invariants stay on the entity.
4. Inject the factory the same way ports are injected: constructor parameter on the use case.

## 8.7 Add a new infrastructure adapter (e.g. Postgres)

1. Implement the relevant output port in `src/infrastructure/<concern>/<tech>-<port>.ts`.
2. If persistence: define a record type + mapper inside `infrastructure/persistence/`.
3. Add the adapter to the contract test (see [testing.md](./testing.md#104-contract-tests-for-adapters)) so it passes the same suite as the in-memory one.
4. Swap it in at the composition root. Application and domain do not change.

## 8.8 Add a new delivery mechanism

1. Add `src/presentation/<mechanism>/…` depending only on input ports + DTOs + (optional) `DomainError`.
2. Add a new composition root `src/<mechanism>.ts` that wires adapters → use cases → mechanism.
3. Add an npm script.

## 8.9 Add a new env var

See [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts) step list.

## 8.10 Add a new domain error code

1. Add the class to `errors.ts` with a `SCREAMING_SNAKE_CASE` `code`.
2. Add the code → status mapping in every presentation `statusByCode` table that should expose it.
3. Once shipped, **never rename the code** — it's a public contract. Only add new codes.

## 8.11 Add a use-case decorator

1. Create the decorator at `src/application/use-cases/<adjective>-<verb>-<noun>.ts` implementing the same input port as the inner use case.
2. Wire it in each composition root: `new LoggedCreateUser(new CreateUser(...), logger)`.
3. Test the decorator with a fake inner use case implementing the input port — don't depend on the real inner.
4. Mind the decorator order (see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)).

## 8.12 Add a read-model port

1. Define the port at `src/application/ports/output/<noun>-read-model.ts` returning a query DTO directly.
2. Add an in-memory adapter (mandatory — see [ports-adapters.md](./ports-adapters.md#53-in-memory-adapter-is-mandatory)) and any production adapter.
3. Inject it into the relevant query use case. The aggregate and its repository are unaffected.

## 8.13 Add an Output Boundary

1. Define the output type at `src/application/ports/output/<verb>-<noun>-output.ts` — a small interface with one method per outcome (`ok`, `conflict`, `notFound`).
2. Change the use case's `execute` signature to take the output as a second argument (and return `void`).
3. Update each presentation entrypoint to implement the output and pass it in.
4. Use cases that already return DTOs stay that way — only adopt this for use cases whose outcomes don't fit a single return type.

## 8.14 Add a domain event

1. Create the event type at `src/domain/<context>/events/<name>.ts` — past-tense, immutable, primitives only.
2. Have the aggregate's mutating method buffer the event in a private field (`this.events.push(...)`).
3. The use case dispatches buffered events via the `EventPublisher` output port at the end of `execute`.
4. Subscribers live in `application/` (handler classes) or other contexts (via their own adapter).
5. Subscribers are idempotent (see [application.md](./application.md#44-idempotency-and-retries)).

## 8.15 Add a saga / process manager

1. Create `src/application/sagas/<name>.ts`.
2. The saga subscribes to one or more domain events via the `EventPublisher` port.
3. The saga's state is its own aggregate, persisted via its own repository (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)).
4. Compensating steps are explicit use cases the saga calls — not buried `try/catch`.
5. The saga is idempotent.

## 8.16 Split an aggregate

When an aggregate has grown past Vernon's "small aggregates" rule (see [domain-modeling.md](./domain-modeling.md#33-aggregates-and-aggregate-roots)):

1. Identify the true invariant that requires the consistency boundary. Anything outside that invariant is a candidate for extraction.
2. Extract the candidate into its own aggregate with its own root, repository, and id.
3. Replace inner references with id references (Vernon Rule 3).
4. Where the old aggregate enforced cross-boundary consistency, introduce a domain event + saga (see [domain-modeling.md](./domain-modeling.md#36-domain-events) and [cross-cutting.md](./cross-cutting.md#66-sagas--process-managers)) or accept eventual consistency.
5. Ship the change behind Branch by Abstraction (see [cross-cutting.md](./cross-cutting.md#612-migration-patterns-strangler-fig-branch-by-abstraction)) if the old shape is widely used.

## 8.17 Retire a use case

1. Mark the input port `@deprecated` with a JSDoc note pointing to the replacement.
2. Add a deprecation log at the start of `execute` so usage is observable.
3. Remove presentation entrypoints once telemetry shows no traffic for a full release cycle.
4. Remove the use case class and input port.
5. Update the changelog / release notes — input ports are part of the public surface for any in-tree consumer.

## 8.18 Migrate an adapter (Branch by Abstraction)

1. Confirm the port already exists; if not, extract it from the legacy adapter first.
2. Implement the new adapter in `infrastructure/`.
3. Add the new adapter to the contract test (see [testing.md](./testing.md#104-contract-tests-for-adapters)) — it must pass the same suite.
4. Add a config flag (see [cross-cutting.md](./cross-cutting.md#69-caching-rate-limiting-multi-tenancy-audit-feature-flags)) to choose the adapter at composition time.
5. Roll the flag forward; monitor; remove the legacy adapter and the flag.

## 8.19 Add a resilience decorator (timeout / retry / circuit breaker)

1. Wrap the adapter, not the use case: `new RetryingUserRepository(new PostgresUserRepository(...), { attempts: 3, backoff: ... })`.
2. The wrapper is itself an adapter implementing the same output port.
3. Only retry when the operation is idempotent (see [application.md](./application.md#44-idempotency-and-retries)) or guarded by an idempotency key.
4. Add the wrapper to the contract test if its behavior diverges meaningfully from the inner adapter (e.g., it should still satisfy round-trip identity even with retries).

## 8.20 Add a feature flag

1. Add a `FeatureFlags` output port if one doesn't exist.
2. Read the flag in the composition root (to choose between adapters / decorator stacks) or inside a small decorator (to choose between behaviors per call).
3. **Never** read flags inside a use case directly — flags are wiring, not business logic.
4. Plan for flag removal at flag creation — every flag has a retirement criterion.

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [domain-modeling.md](./domain-modeling.md) · [application.md](./application.md) · [ports-adapters.md](./ports-adapters.md) · [cross-cutting.md](./cross-cutting.md) · [testing.md](./testing.md)
