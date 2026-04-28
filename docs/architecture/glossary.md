# Glossary

Use these terms with these meanings. If a contributor uses a term differently, point them here. The vocabulary is split into three groups: tactical (in-the-code), strategic (between-bounded-contexts), and test terms (Meszaros).

## Tactical (in-the-code) terms

- **Entity** — A domain object with stable identity (`id`). Two entities with the same fields but different ids are different entities.
- **Value Object (VO)** — An immutable domain object compared by structural equality, not identity. Self-validating in its factory. Example: `Email`, `Money`, `DateRange`.
- **Domain Primitive** — A VO that wraps a single primitive to give it meaning and validation (`UserId(string)`, `Quantity(number)`). Synonym: "tiny type."
- **Branded Type** — TypeScript implementation technique for a domain primitive when a class is overkill: `type UserId = string & { readonly __brand: "UserId" }`. Equivalent semantically to a VO; loses runtime validation, so use only when the value is opaque and validated at one boundary.
- **Aggregate** — A cluster of entities and value objects treated as one consistency boundary.
- **Aggregate Root** — The single entity in an aggregate that external code may reference. Inner members are reached only through the root.
- **Factory** — A construction object (function or class) that produces an entity / aggregate when the construction needs collaborators (clock, id-gen, cross-aggregate lookup) that don't belong as fields. Use when `static create(props)` would force the caller to wire too much.
- **Repository** — An output port whose contract is "store/retrieve aggregates of type X". One repository per aggregate root.
- **Read Model** — An output port returning a query DTO directly, bypassing the aggregate, for queries the aggregate cannot serve cheaply.
- **Domain Service** — A stateless function/class in `domain/` that orchestrates behavior across multiple entities when the behavior doesn't naturally belong on any one of them.
- **Domain Event** — An immutable past-tense fact (`OrderCancelled`) emitted by an aggregate to notify other parts of the system. See [domain-modeling.md](./domain-modeling.md#36-domain-events).
- **Domain Error** — A subclass of `DomainError` thrown by domain or application code to signal a business-rule violation. Carries a stable `code`.
- **Use Case (Interactor)** — An application-layer class implementing a single business operation. Stateless. Implements an input port. Returns a DTO (or invokes an Output Boundary — see [application.md](./application.md#48-output-boundary-presenter-port)).
- **Input Port (Driving Port)** — A TypeScript interface describing a use case's signature. Presentation depends on input ports, never on use case classes.
- **Output Port (Driven Port, Gateway)** — A TypeScript interface describing a side-effect a use case needs (repository, clock, id generator, …). Defined in `application/`, implemented by `infrastructure/`.
- **Output Boundary (Presenter Port)** — A specialized output port the use case writes results into, instead of returning them. Lets presentation own the rendering format without the use case knowing. See [application.md](./application.md#48-output-boundary-presenter-port).
- **Adapter** — A class in `infrastructure/` (driven) or `presentation/` (driving) implementing a port using a concrete technology.
- **DTO (Data Transfer Object)** — A plain primitives-only data shape returned by a use case or written into an Output Boundary. Crosses outward boundaries.
- **Mapper** — A pure function (or const-object of functions) that translates between two representations: domain↔DTO (in `application/mappers/`) or domain↔persistence-record (in `infrastructure/persistence/`).
- **Composition Root** — The single file per delivery mechanism that wires concrete classes (`src/index.ts`, `src/server.ts`).
- **Use-Case Decorator** — A class implementing the same input port as an inner use case, wrapping it to add a cross-cutting concern (logging, tracing, auth, transactions, retries).
- **Test Data Builder** — A fluent fixture constructor used in tests (`aUser().withEmail("…").build()`) so invariants are owned in one place.
- **Saga / Process Manager** — A long-lived coordinator that reacts to domain events and drives multi-step workflows across aggregates (see [cross-cutting.md](./cross-cutting.md#66-sagas--process-managers)).
- **Unit of Work** — An output port that brackets a set of repository operations into one transaction (see [ports-adapters.md](./ports-adapters.md#55-out-of-scope-by-default)).
- **Specification** — A reusable predicate object representing a domain rule (`UserIsActive`). Used to compose repository queries or in-domain checks. Out of scope by default (see [ports-adapters.md](./ports-adapters.md#55-out-of-scope-by-default)).

## Strategic (between-bounded-contexts) terms

- **Bounded Context** — A self-contained piece of the domain with its own ubiquitous language. Each direct subfolder of `src/domain/` is one bounded context.
- **Ubiquitous Language** — The vocabulary used by domain experts; mirrored exactly by the code in that bounded context.
- **Subdomain** — A slice of the business problem space. Three flavors: **Core** (the differentiator — invest the most), **Supporting** (custom but not differentiating), **Generic** (commodity, prefer buying / off-the-shelf). Code investment scales with subdomain type — see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication).
- **Distillation** — The DDD activity of identifying and protecting the Core domain by extracting supporting/generic concepts out of it.
- **Context Map** — The diagram + written record of how bounded contexts relate. Lives in `docs/context-map.md` once a second context exists. Updated when the relationships change.
- **Anti-Corruption Layer (ACL)** — An adapter that translates between the domain model and a foreign system whose model would otherwise contaminate the domain. Used when the foreign model is hostile.
- **Shared Kernel** — A small subset of the model two bounded contexts agree to share and co-own. High coupling cost — use sparingly (see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)).
- **Customer/Supplier** — Asymmetric relationship: downstream context (customer) gets a voice in upstream's (supplier) priorities.
- **Conformist** — Downstream silently adopts the upstream model without translation. Cheap; risky; appropriate only when the upstream model is benign.
- **Open Host Service** — A bounded context that exposes a stable, public protocol for many downstream consumers (its API is its product surface).
- **Published Language** — The well-documented data format the Open Host Service speaks. JSON schemas, protobufs, OpenAPI documents.
- **Separate Ways** — Explicit decision that two contexts will not integrate. Each goes its own way. Cheaper than forcing a bad integration.
- **Partnership** — Two contexts succeed or fail together; coordinated planning required.
- **Big Ball of Mud** — The anti-pattern where no boundaries exist and everything depends on everything. Treat any drift toward it as a P0 architectural bug.
- **Strangler Fig** — Migration pattern: a new implementation grows around the old, gradually replacing it from the edges in. Often paired with an ACL.
- **Branch by Abstraction** — Migration pattern: introduce a port, route traffic through it, swap the implementation, retire the old one. The day-to-day version of the Strangler Fig.

## Test terms (Meszaros)

- **Test Double** — Umbrella term for a stand-in. Sub-types:
  - **Dummy** — Passed to satisfy a parameter, never used.
  - **Fake** — Working implementation simplified for tests (the in-memory repo is a Fake, not a Mock).
  - **Stub** — Returns canned answers to calls.
  - **Spy** — A Stub that also records its calls.
  - **Mock** — Pre-programmed with expectations; fails the test if called wrong.
    Use the right word — `mockUserRepository` is wrong if it's actually a Fake. Misnaming hides what the test is really asserting.
- **Architectural Fitness Function** — An automated test that fails when a stated architectural rule is violated (e.g., "no `application/` file imports from `infrastructure/`"). Lives next to the test suite.

---

**See also:** [dependency-rule.md](./dependency-rule.md) · [domain-modeling.md](./domain-modeling.md) · [testing.md](./testing.md)
