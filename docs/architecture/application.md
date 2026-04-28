# Application layer rules

The application layer is where use cases live: one class per business operation, depending on the domain through types and on the outside world through ports. This module covers granularity and naming, validation tiers, error-handling philosophy, idempotency, the decorator pattern for cross-cutting concerns, the DTO contract, mapper rules, and the Output Boundary alternative.

## 4.1 Use case granularity, naming, CQS, CQRS

- **One class per business operation.** No `UserService.doEverything()` — split into `CreateUser`, `UpdateUser`, `DeleteUser`.
- Use cases are named in **imperative verb + noun**: `CreateUser`, `CancelOrder`, `RebuildIndex`. A class named after a noun (`UserService`) is a code smell.
- Follow **Command / Query Separation (CQS)**:
  - **Commands** mutate state, named with mutating verbs: `create-`, `update-`, `delete-`, `cancel-`, `approve-`. May return a single DTO confirming the result.
  - **Queries** are pure reads, named with read verbs: `get-`, `list-`, `find-`, `count-`. Never mutate state — including via output ports.
- A single use case mutates **at most one aggregate** (see [domain-modeling.md](./domain-modeling.md#33-aggregates-and-aggregate-roots)).
- Use cases use **constructor injection** for all dependencies. No service-locator, no global registries, no `import` of concrete adapters.
- Use cases are **stateless**: no instance fields except the injected ports.
- **CQS, not full CQRS by default.** Queries and commands share the same domain model and repositories. If a query needs a denormalized projection that the aggregate cannot serve cheaply, define a separate **read-model port** (`UserReadModel`) returning a query DTO directly, instead of contorting the repository or the aggregate. This is the sanctioned step toward CQRS.
- **Full CQRS** (separate write model, read model, and persistence stores; reads served from a projection updated by events) is shipped as a worked example for the Order context: `ListOrders` (CQS, aggregate-backed) and `ListOrderSummaries` (CQRS, projection-backed) sit side-by-side. The read side uses two narrow ports — `OrderSummaryReadModel` for queries (`src/application/ports/output/order-summary-read-model.ts`), `OrderSummaryProjection` for writes (`src/application/ports/output/order-summary-projection.ts`) — both implemented by `InMemoryOrderSummaryReadModel`. The projection is rebuilt by `OrderSummaryProjector` (`src/application/projections/order-summary-projector.ts`), which subscribes to the Order events. Adopt this style when (a) read scale dwarfs write scale by an order of magnitude, (b) read shapes diverge meaningfully from the aggregate, or (c) you already have a reliable event stream. Don't adopt it for "future-proofing."
- **Event Sourcing** (storing events as the source of truth, deriving aggregate state by replay) is out of scope by default. It's a deep commitment — schema migration becomes event-version migration. If adopted, the aggregate replays events in `reconstruct(events: DomainEvent[])`; the repository is renamed to `EventStore`; snapshots become a performance concern.

## 4.2 Validation tiers

There are three places where validation happens. Put each kind in its own tier:

| Tier            | What it validates             | Where                         | Failure                                    |
| --------------- | ----------------------------- | ----------------------------- | ------------------------------------------ |
| Transport shape | "Is `email` a string?"        | Presentation (route, command) | Transport-level error (HTTP 400, CLI exit) |
| Domain format   | "Is this a valid email?"      | VO factory (`Email.create`)   | `DomainError` (`INVALID_EMAIL`)            |
| Business rule   | "Is the email already taken?" | Use case                      | `DomainError` (`EMAIL_ALREADY_EXISTS`)     |

A check exists in only one tier. Don't validate the email format in three places; trust the inner tier.

## 4.3 Error handling philosophy

- **Throw, don't return.** Use cases throw `DomainError` subclasses on business-rule violations; they don't return `Result<T, E>` / `Either` types. The control-flow stack is the channel.
- Presentation catches `DomainError` once at the boundary and translates `code` → HTTP status / CLI exit code via a centralized table (e.g. `statusByCode` in `src/presentation/http/server.ts`).
- Unexpected errors (not `DomainError`) are mapped to a generic 500 / exit 1 by the boundary handler. The original error is logged for diagnostics; the message must not leak to the client.
- Transport-level errors (malformed payload, missing CLI flag) are **not** `DomainError` — throw a plain `Error` (or a transport-specific subclass) so they don't acquire a `code` that callers might programmatically depend on.

## 4.4 Idempotency and retries

- Commands that may be retried by the caller (HTTP client retries, queue redeliveries, user double-clicks) must be **idempotent by design**. Either:
  - The operation is naturally idempotent (`SetUserEmail` to the same email twice is a no-op), or
  - The use case accepts a caller-supplied `idempotencyKey: string` and a dedicated `IdempotencyStore` output port deduplicates within a window.
- Never make idempotency the caller's problem ("just don't retry"). The system tolerates at-least-once delivery from any transport that supports retries.
- Queries are idempotent by definition (see §4.1) — this rule applies to commands.
- Domain-event subscribers (see [domain-modeling.md](./domain-modeling.md#36-domain-events)) are idempotent for the same reason: events are at-least-once.

## 4.5 Use-case decorators (cross-cutting concerns)

When you need logging, tracing, metrics, authorization, transactions, retries, caching, or rate-limiting around a use case, **wrap it** rather than inlining the concern. Each concern is a class implementing the same input port:

```ts
class LoggedCreateUser implements CreateUserUseCase {
	constructor(
		private readonly inner: CreateUserUseCase,
		private readonly logger: Logger,
	) {}

	async execute(input: CreateUserInput): Promise<UserDto> {
		this.logger.info("create_user.start", { email: input.email });
		try {
			const result = await this.inner.execute(input);
			this.logger.info("create_user.ok", { id: result.id });
			return result;
		} catch (error) {
			this.logger.warn("create_user.fail", { error });
			throw error;
		}
	}
}
```

Wiring happens in the composition root: `new LoggedCreateUser(new CreateUser(...), logger)`. Use cases stay focused on the business operation; decorators are independently testable and stackable.

**Decorator order matters.** Build outward from the use case: `Auth(Tx(Retry(Logged(Traced(Inner)))))`. Authorization fails fast (no point retrying a forbidden call); transactions wrap retries (a retry must be inside the transaction, or each retry needs its own); logging captures the result the caller actually sees.

## 4.6 DTO contract

DTOs are the data shape that crosses the application↔presentation boundary. They are not domain types in disguise.

- **Primitives only.** `string`, `number`, `boolean`, `null`, arrays of these, and nested DTO objects of these. **No** `Date`, `Map`, `Set`, `BigInt`, class instances, or VO objects on a DTO. Convert at the mapper edge (`createdAt.toISOString()`, `email.value`).
- **`readonly` everywhere.** All fields and array members are `readonly`. Presentation must not mutate a DTO before serializing it.
- **No methods, no behavior.** A DTO is a `type`/`interface`, not a class. Equality is structural.
- **Additive evolution only.** Once a DTO field is exposed by a delivery mechanism, treat it as a public contract. Add new optional fields freely; renaming or removing a field is a breaking change to clients (HTTP API consumers, CLI scripters). Removing requires a deprecation cycle: ship the new field, mark the old as deprecated, remove only after consumers migrate.
- **Serializable.** A DTO must round-trip through `JSON.stringify` / `JSON.parse` losslessly. If you can't `JSON.stringify` it, it isn't a DTO.
- **Postel's Law** at the boundary: be liberal in what you accept (presentation may coerce `"42"` → `42` on input), conservative in what you emit (DTOs out have exact shapes). Coercion happens in presentation, not in the use case.

## 4.7 Mapper rules

- **Pure functions.** Mappers take inputs and return outputs. No I/O, no `new Date()` (use the ports if you need _now_), no logging, no state.
- **Total.** A mapper either succeeds for the entire input domain or throws a `DomainError`. Don't return `undefined` to mean "couldn't map this" — the caller can't reason about it.
- **Two flavors:**
  - `application/mappers/<noun>-mapper.ts` — domain entity ↔ DTO (outward boundary).
  - `infrastructure/persistence/<noun>-record.ts` — domain entity ↔ persistence record (downward boundary). The record type stays inside `infrastructure/persistence/` (see [ports-adapters.md](./ports-adapters.md#52-repository-rules)).
- **Direction-explicit names.** `toDto` / `toDomain` / `toRecord`. Don't use ambiguous names like `map` or `transform`.

## 4.8 Output Boundary (Presenter port)

Sometimes returning a DTO is the wrong shape — the use case needs to push results progressively (streaming), or render multiple formats (HTML + JSON + CSV) without knowing which, or signal multi-step outcomes (success / partial / failure). For these cases, invert the dependency on presentation by giving the use case an **Output Boundary**:

```ts
type CreateUserOutput = {
	ok(user: UserDto): void;
	conflict(email: string): void;
};

class CreateUser implements CreateUserUseCase {
	async execute(input: CreateUserInput, out: CreateUserOutput): Promise<void> {
		// …
		out.ok(userMapper.toDto(user));
	}
}
```

Presentation implements `CreateUserOutput` (the route writes JSON, the CLI writes a line, the queue ack/nacks). The use case never imports presentation.

**Default to returning a DTO** (see §4.1) — it's simpler, easier to test, and sufficient for sync request/response. Reach for an Output Boundary only when one of the conditions above genuinely applies. Mixing both styles in the same project is fine; mixing them in the same use case is not.

---

**See also:** [domain-modeling.md](./domain-modeling.md) · [ports-adapters.md](./ports-adapters.md) · [cross-cutting.md](./cross-cutting.md) · [recipes.md](./recipes.md)
