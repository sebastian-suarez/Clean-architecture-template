# Layer responsibilities

What lives in each layer, what is forbidden, and what enters where. The four layers (`domain`, `application`, `infrastructure`, `presentation`) plus the composition root form a strict outer-to-inner stack — see [dependency-rule.md](./dependency-rule.md) for the rule that governs the imports between them.

## 2.1 Domain (`src/domain/`)

Enterprise business rules. Pure TypeScript. Zero I/O, zero framework, zero `Date.now()` / `Math.random()` / `process.env`.

Lives here:

- **Entities** — see [domain-modeling.md](./domain-modeling.md#31-entities).
- **Value objects** — see [domain-modeling.md](./domain-modeling.md#32-value-objects).
- **Aggregate roots** — see [domain-modeling.md](./domain-modeling.md#33-aggregates-and-aggregate-roots).
- **Domain services** — see [domain-modeling.md](./domain-modeling.md#34-domain-services).
- **Domain errors** — see [domain-modeling.md](./domain-modeling.md#35-domain-errors).
- **Domain events** (if used) — see [domain-modeling.md](./domain-modeling.md#36-domain-events).
- **Factories** (if used) — see [domain-modeling.md](./domain-modeling.md#38-factories).
- **Specifications** (if used) — see [ports-adapters.md](./ports-adapters.md#55-out-of-scope-by-default).

Forbidden:

- `import` from `#application/*`, `#infrastructure/*`, `#presentation/*`.
- Any third-party package import (`hono`, `vitest`, framework SDKs, etc.).
- Mutable global state.
- Direct calls to `Date`, `crypto.randomUUID`, `fetch`, `fs`, `process`, `console.*` (use a port, injected — see [cross-cutting.md](./cross-cutting.md)).
- Public mutable fields. Use `readonly` everywhere.

Permitted from `node:` / JS std-lib (pure, deterministic types only):

- Type-only usage of `Date` (as a parameter or field type — see [cross-cutting.md](./cross-cutting.md#62-time-and-identity) for _constructing_ dates).
- `URL`, `URLSearchParams`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Symbol`.
- `Intl.*` formatters, only if constructed from explicit inputs (no implicit host locale).

Anything else from `node:` (`fs`, `crypto`, `process`, `os`, `child_process`, `net`, `http`, …) is forbidden and must enter through a port.

## 2.2 Application (`src/application/`)

Use-case orchestration. Knows the domain; defines what the system does.

Lives here:

- **Use cases** (`use-cases/`) — see [application.md](./application.md).
- **Use-case decorators** (`use-cases/`) — see [application.md](./application.md#45-use-case-decorators-cross-cutting-concerns).
- **Input ports** (`ports/input/`) — TypeScript types describing each use case's signature.
- **Output ports** (`ports/output/`) — TypeScript types describing side-effects.
- **Read-model ports** (`ports/output/`) — TypeScript types returning query DTOs directly (see [application.md](./application.md#41-use-case-granularity-naming-cqs-cqrs)).
- **Output boundary ports** (`ports/output/`) — when use cases push results instead of returning them (see [application.md](./application.md#48-output-boundary-presenter-port)).
- **DTOs** (`dtos/`) — plain primitives-only data shapes.
- **Mappers** (`mappers/`) — pure functions that turn domain entities into DTOs.
- **Sagas** (`sagas/`) — long-lived coordinators (see [cross-cutting.md](./cross-cutting.md#66-sagas--process-managers)), only if the project uses them.

Forbidden:

- `import` from `#infrastructure/*`, `#presentation/*`.
- Returning a domain entity from a use case (always map to a DTO).
- Calling `Date`, `crypto`, `fs`, `fetch`, `process`, `console.*` directly — inject a port.
- Importing any framework (`hono`, an ORM, etc.).
- Stateful use cases. A use case must hold no mutable state across calls; per-call data lives in locals.

## 2.3 Infrastructure (`src/infrastructure/`)

Adapters. Implements **driven (output) ports** with concrete technology.

Rules:

- Every class here `implements` an output port from `#application/ports/output/*`.
- File names reflect the technology: `json-file-user-repository.ts`, `postgres-user-repository.ts`, `redis-cache.ts`.
- One folder per concern (`persistence/`, `clock/`, `id/`, `http-clients/`, `messaging/`, `logging/`, `cache/`, …).
- Persistence adapters use a **mapper** (see [ports-adapters.md](./ports-adapters.md#52-repository-rules)) to translate between the persistence record type (scoped to the persistence directory) and the domain entity. Persistence record types do not escape this layer.
- For every output port, an in-memory adapter must exist alongside any production adapter (see [ports-adapters.md](./ports-adapters.md#53-in-memory-adapter-is-mandatory)).
- Resilience wrappers (timeout, retry, circuit breaker — see [cross-cutting.md](./cross-cutting.md#68-resilience)) live as adapter decorators in this layer, not inside use cases.

Forbidden:

- `import` from `#presentation/*`.
- Implementing more than one port per file.
- Letting persistence record types escape this layer.

## 2.4 Presentation (`src/presentation/`)

Delivery mechanisms (driving adapters). Translates a transport (CLI argv, HTTP request, message-queue payload) into an input-port call, and a DTO / domain error back into a transport response.

Rules:

- Depend on **input ports** (`#application/ports/input/*`), never on use-case **classes**.
- Consume **DTOs** in responses; do not import domain entities or value objects for data.
- May import `DomainError` from `#domain/shared/domain-error.js` to translate `code` → status / exit code. **This is the only domain symbol presentation may use in production code.**
- One folder per delivery mechanism (`cli/`, `http/`, `queue/`, `grpc/`, `ws/`, …). Adding a new one must not require any change in `application/` or `domain/`.
- May call `console.*` directly for transport-level diagnostics. Use cases and domain may not.
- Validates **transport shape only** (e.g., "is `email` a string?"). Business validation lives in the use case or domain (see [application.md](./application.md#42-validation-tiers)).
- Transport-level errors thrown to indicate "the request is malformed before we even reach the use case" use a plain `Error` (or a transport-specific subclass). Only `DomainError` carries a stable `code`.

Forbidden:

- Calling `infrastructure/` directly. The composition root injects use cases.
- Containing business rules. If a check is interesting, it belongs in a use case or the domain.

## 2.5 Composition root (`src/index.ts`, `src/server.ts`) and config (`src/config.ts`)

The **only** place where concrete classes are instantiated and wired together. Each delivery mechanism gets its own composition root file at `src/`.

Rules:

- Composition roots call `loadConfig()` from `#src/config.js`, then construct adapters → use cases → presentation.
- `process.exit`, `process.argv`, and other "edge of world" calls live here, not deeper.
- Adding a new delivery mechanism = new file at `src/<name>.ts` + new npm script.
- The composition root is the **only** place in the codebase where `new <ConcreteAdapter>(...)` may appear. Anywhere else, depend on the port type. A grep for `new JsonFile…`, `new Postgres…`, `new System…` outside `src/<delivery>.ts` is a red flag.
- Composition roots stay **thin and declarative**. No business logic, no `if`/`switch` on env values beyond what `loadConfig()` already returned. If wiring grows complex, extract a `compose<X>(config)` factory in the same file — never in a separate "container" module that other layers might import.
- A DI/IoC container library is forbidden. Plain `new` calls in the composition root are the standard. Containers obscure the wiring graph and re-introduce the global registry the dependency rule eliminates.

**Configuration (`src/config.ts`) is the _only_ module allowed to read `process.env`.** It exposes a typed `AppConfig` and a `loadConfig()` function. `dotenv` is a `devDependency` and is loaded only when `NODE_ENV !== "production"` via a guarded dynamic import — production must inject env vars via the runtime (Docker, systemd, k8s, …).

If you need a new env var:

1. Add it to `AppConfig` and parse it in `loadConfig()` (with validation).
2. Add a documented entry to `.env.example`.
3. Pass the parsed value down from the composition root — **never** read `process.env` directly elsewhere.

---

**See also:** [dependency-rule.md](./dependency-rule.md) · [ports-adapters.md](./ports-adapters.md) · [cross-cutting.md](./cross-cutting.md) · [forbidden-patterns.md](./forbidden-patterns.md)
