# Cross-cutting concerns

Concerns that aren't owned by any single layer: logging, time/identity, config, auth, inter-context communication, sagas, observability, resilience, caching/rate-limit/audit/flags, secrets, i18n, and migration patterns. The recurring shape: a port per concern, an in-memory adapter for tests, wired in the composition root, often applied as a use-case or adapter decorator.

## 6.1 Logging

- No production code in `domain/` or `application/` may call `console.*`.
- Presentation may call `console.*` for transport-level diagnostics. Composition roots may call `console.*` for boot/shutdown messages.
- If the project grows to need structured logging, add a `Logger` output port (`info`, `warn`, `error`) and inject it into use cases that need it (preferably via a decorator — see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)). Provide a console / pino / cloud-logging adapter in `infrastructure/logging/`.
- Log fields are **structured** (object) — never f-string log messages with interpolated state. Search/aggregation tools rely on field names.
- Never log secret-bearing fields (see §6.10).

## 6.2 Time and identity

- The current time enters the system through the `Clock` output port. Domain and application code never call `new Date()` / `Date.now()`.
- Identifiers enter the system through the `IdGenerator` output port. Domain and application code never call `crypto.randomUUID()` / `Math.random()`.
- This rule exists so use cases are deterministic given their inputs and port doubles — a cornerstone of testability.
- **Clock returns UTC.** `Clock.now(): Date` is always UTC. Time-zone-aware presentation ("your local time is …") happens in the presentation layer, fed by the user's locale / preference, not by the host's `TZ` env var.
- **Monotonic vs wall-clock.** If the domain needs _durations_ (rate-limiting, "expired after N seconds"), prefer a separate `Monotonic.now(): number` (ms-since-arbitrary-epoch) port — wall-clock can jump backwards under NTP correction. Most use cases don't need this; add it only when correctness depends on it.

## 6.3 Configuration

See [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts). Read by `src/config.ts`, injected from there. Forbidden anywhere else.

## 6.4 Authentication / authorization

If introduced:

- **Authentication** (who is this?) lives at the presentation boundary. The route extracts the principal from the transport (header, cookie, JWT) and passes a `principalId: string` (or richer DTO) into the use case.
- **Authorization** (may they do this?) is enforced inside the use case against the principal. The use case throws a `ForbiddenError extends DomainError` (`code: "FORBIDDEN"`) on denial.
- For coarse, route-level auth ("any signed-in user can hit `/users`"), prefer a **use-case decorator** that checks the principal before delegating (see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)). For fine-grained, data-aware auth ("can this user see this order?"), the check belongs inside the use case where the data is loaded.
- Never trust transport-level claims that haven't been verified by the auth adapter. Token verification happens in `infrastructure/auth/`, not in the route.

## 6.5 Inter-context communication

When one bounded context needs data or behavior from another bounded context **inside the same repo**, treat the boundary as seriously as a network boundary:

- **Don't import a foreign context's entities or VOs.** `domain/billing/` cannot `import` from `domain/user/`. The two contexts have different ubiquitous languages — a `User` in billing and a `User` in identity are different concepts that happen to share a name.
- **Communicate through published-language DTOs** owned by the consumer's application layer, populated by an adapter. Concretely: define an output port (`BillingCustomerLookup`) in the consumer's `application/ports/output/`; implement the adapter in `infrastructure/` so it calls into the other context (in-process today, RPC tomorrow) and translates to the consumer's DTO. This is the ACL pattern (see [ports-adapters.md](./ports-adapters.md#54-anti-corruption-layer-acl)) applied internally.
- **Shared Kernel is forbidden by default.** Only the bare minimum (`DomainError`, broadly-applicable VOs like a generic `Money` if and only if both contexts genuinely use the same definition) may live in `domain/shared/`. When in doubt, duplicate — duplication across contexts is healthier than coupling.
- **Domain events are the preferred coupling** when a context needs to _react_ to another context's changes (see [domain-modeling.md](./domain-modeling.md#36-domain-events)). Direct synchronous calls between contexts should be the exception, not the default.
- **No cycles between contexts** (ADP — see [dependency-rule.md](./dependency-rule.md#13-component-principles-uncle-bob-part-iv)). If two contexts need each other, one is misnamed or the boundary is in the wrong place.

**Subdomain investment.** Classify each context by its subdomain type (see [glossary.md](./glossary.md#strategic-between-bounded-contexts-terms)):

- **Core** — invest the most modeling effort. Custom code, deep aggregates, tested heavily. This is where the business wins.
- **Supporting** — custom but not differentiating. Reasonable models, less ceremony than Core.
- **Generic** — buy or use OSS. If you must build, keep it minimal and isolated behind an ACL so you can swap to a vendor later.

Don't pour Core-level effort into a Generic subdomain; don't ship a Generic-quality model for Core.

**Context-map relationship vocabulary.** When you document how two contexts interact (in `docs/context-map.md`), use the names from [glossary.md](./glossary.md#strategic-between-bounded-contexts-terms):

| Pattern              | Power dynamic             | When to use                                             |
| -------------------- | ------------------------- | ------------------------------------------------------- |
| Shared Kernel        | Equal, co-owned           | Tiny shared model both teams agree to govern jointly    |
| Customer / Supplier  | Downstream has a voice    | Downstream depends on upstream; planning negotiated     |
| Conformist           | Upstream dictates         | Upstream is benign; translation cost not worth it       |
| Anticorruption Layer | Downstream isolates       | Upstream is hostile / legacy; protect your model        |
| Open Host Service    | Upstream serves many      | Many downstreams; stable public protocol justified      |
| Published Language   | Pairs with Open Host      | Documented, versioned format (JSON schema, protobuf, …) |
| Separate Ways        | No relationship           | Integration cost > integration benefit                  |
| Partnership          | Mutual success or failure | Neither side can ship without the other                 |
| Big Ball of Mud      | (anti-pattern)            | Treat as a bug; don't deepen it                         |

Default for new contexts in this repo: **Anticorruption Layer in both directions**. Loosen only with explicit justification.

## 6.6 Sagas / process managers

A worked example ships in `src/application/sagas/order-confirmation-saga.ts`. The saga subscribes to `OrderPlaced`, drives a two-step workflow (reserve inventory via `InventoryReservation` → confirm the order via the `ConfirmOrder` use case), and compensates by calling `CompensateOrderConfirmation` if the reservation fails. State lives in the `OrderProcess` aggregate (`src/domain/order/order-process.ts`), persisted via `OrderProcessRepository` with optimistic concurrency (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)).

- The saga lives in `application/sagas/<name>.ts` and listens to domain events via the `EventPublisher` port (see [domain-modeling.md](./domain-modeling.md#36-domain-events)).
- The saga's state is an aggregate of its own — persisted via its own repository, with the same atomicity rules (see [domain-modeling.md](./domain-modeling.md#37-aggregate-transactional-rules)).
- Compensating actions for partial failures are explicit use cases (e.g. `CompensateOrderConfirmation`), not buried `try/catch` cleanup. The compensation is its own input port so the auth check that protects the user-driven `CancelOrder` doesn't apply to the system-initiated rollback.
- Sagas are **idempotent** by construction (see [application.md](./application.md#44-idempotency-and-retries)) — the same event delivered twice produces the same final state. The example dedupes on `OrderProcessRepository.findByOrderId(orderId)` before doing work, so at-least-once `OrderPlaced` delivery is safe.

Don't smuggle a saga into a use case as a long `try { … } catch { rollback() }` block — that creates a hidden state machine no one can reason about.

## 6.7 Observability (logs, metrics, traces)

The three observability signals each enter through their own port, never directly:

- **`Logger`** — see §6.1.
- **`Metrics`** — `counter(name, tags)`, `histogram(name, value, tags)`, `gauge(name, value, tags)`. Adapter in `infrastructure/metrics/` for Prometheus / StatsD / vendor.
- **`Tracer`** — `startSpan(name, attributes): Span` with `span.end()` / `span.recordError()`. Adapter in `infrastructure/tracing/` for OpenTelemetry / vendor.

Wire them as **decorators** (see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns)) — `TracedCreateUser`, `MeteredCreateUser` — not by littering use cases with `tracer.startSpan` calls. The use case stays focused on the business operation; the decorator owns the cross-cutting concern.

## 6.8 Resilience

When an output port talks to a flaky dependency (network, third party, slow disk), apply resilience patterns at the **adapter** layer, as wrappers, not inside use cases:

- **Timeout** — bound every outbound call. No naked `await fetch(...)`.
- **Retry** with exponential backoff and jitter. Only retry idempotent operations or those guarded by an idempotency key.
- **Circuit breaker** — open after N consecutive failures, half-open after a cooldown.
- **Bulkhead** — cap the concurrent in-flight calls per dependency so one bad backend doesn't starve the rest.
- **Fallback** — explicit, business-meaningful default when the dependency is down (cached value, neutral response). Fallbacks are a domain decision, not a technical one — a fallback that ships wrong data is worse than an error.

Implement as adapter decorators: `RetryingUserRepository`, `TimedOutHttpClient`. Wired in the composition root.

## 6.9 Caching, rate limiting, multi-tenancy, audit, feature flags

All of these are out of scope by default. If introduced, follow the same pattern: a port per concern, an in-memory adapter for tests (see [ports-adapters.md](./ports-adapters.md#53-in-memory-adapter-is-mandatory)), wired via decorator or composition.

- **Caching** — `Cache<T>` port with `get`/`set`/`invalidate`. Wrap a repository in a `CachedUserRepository` decorator. The cache is invalidated by the same use case that mutates the underlying data; cache invalidation is _never_ the cache adapter's responsibility to figure out.
- **Rate limiting** — `RateLimiter` port with `check(key): Promise<Allowed | Denied>`. Applied as a use-case decorator or at the presentation boundary.
- **Multi-tenancy** — every use case that touches tenant-scoped data takes a `tenantId` (or the principal carries it). Repositories filter by tenant; the in-memory adapter must also enforce isolation, otherwise tests pass against a model production rejects.
- **Audit logging** — define an `AuditLog` output port; emit entries from a decorator on mutating use cases. Audit entries are append-only and carry `principalId`, `action`, `targetId`, `timestamp`, `outcome`.
- **Feature flags** — `FeatureFlags` output port (`isEnabled(flag, principalId): boolean`). Read in the composition root or inside a decorator that selects which inner use case to call. **Never `if (env === "prod")` inside a use case** — that's a feature flag with worse ergonomics.

## 6.10 Secrets handling

- Secrets (DB passwords, API keys, JWT signing keys) enter the process the same way other config does (see [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts)): parsed in `src/config.ts`, injected from the composition root. They never appear in source, tests, fixtures, or `.env.example` (use a placeholder like `REPLACE_ME`).
- **Never log a secret.** Mappers, error formatters, and the global `onError` handler must redact known-sensitive fields (`password`, `token`, `authorization`, `cookie`, `apiKey`). When in doubt, redact.
- **Never put a secret in a `DomainError` message** (see [domain-modeling.md](./domain-modeling.md#35-domain-errors)). Error messages surface to clients (HTTP body, CLI stderr) — keep them about the _business outcome_, not the underlying credential.
- A leaked secret is **rotated**, not redacted-after-the-fact. Rotation is a runbook step (config change + redeploy), not a code change.
- **Encryption at rest** for sensitive data is handled by the persistence adapter, not the domain. The domain holds plaintext; the adapter encrypts on `save` and decrypts on `findById`. Key material lives in config (see [layer-responsibilities.md](./layer-responsibilities.md#25-composition-root-srcindexts-srcserverts-and-config-srcconfigts)).
- **Encryption in transit** is handled by the transport (TLS at the load balancer / framework). The domain doesn't know about it.

## 6.11 Internationalization

If introduced:

- Domain errors carry **codes** (see [domain-modeling.md](./domain-modeling.md#35-domain-errors)), not messages, as their public contract. The presentation layer translates `code` → localized message using the request's locale.
- Domain code never imports a translation table or formats a localized string. If a domain message _must_ embed a value (a quantity, a name), that's done at the presentation layer using the structured fields on the error.
- Locale is a presentation concern: extracted from a header / user preference in presentation, never read from `process.env.LANG`.

## 6.12 Migration patterns (Strangler Fig, Branch by Abstraction)

Use these when replacing a legacy implementation behind a port:

- **Branch by Abstraction** is the day-to-day move:
  1. Define (or already have) the output port.
  2. Adapter A is the existing implementation; adapter B is the replacement.
  3. The composition root chooses one (often via a feature flag — see §6.9) per call or per environment.
  4. Migrate traffic gradually; retire A when B is stable.
- **Strangler Fig** is the same idea applied at a coarser scale — a whole new bounded context grows around the old, with an ACL (see [ports-adapters.md](./ports-adapters.md#54-anti-corruption-layer-acl)) translating between them, until the old context can be deleted. Used for legacy modernization.

Never edit the legacy code path to "improve it" mid-migration — that defeats the point and creates a third state to reason about. Add the new path; route to it; delete the old.

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [application.md](./application.md) · [ports-adapters.md](./ports-adapters.md) · [domain-modeling.md](./domain-modeling.md) · [recipes.md](./recipes.md)
