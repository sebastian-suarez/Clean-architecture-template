# Testing rules

How tests are organized, what each layer's tests look like, the pyramid this template aims for, the conventions every test follows, contract tests for substitutable adapters, and architectural fitness function tests that catch boundary violations statically.

## 10.1 Layer-specific test strategies

- **Domain tests** — pure, synchronous, no doubles. Test VO validation, entity invariants, domain service algorithms.
- **Application (use case) tests** — drive the use case through its input port; substitute output ports with the in-memory adapter and hand-rolled `Clock` / `IdGenerator`. Assertions are on the returned DTO (or the calls captured by an Output Boundary spy).
- **Infrastructure tests** — integration tests against the real adapter where feasible (real fs, real DB in a container). Plus the contract test (see §10.4).
- **Presentation tests** — drive the route/command with a fake use case implementing the input port. Assertions are on the transport (HTTP status, CLI stdout/exit code).
- **Architecture tests** (see §10.5) — automated checks that the dependency rule and other invariants hold.

## 10.2 The test pyramid

Many fast, isolated **domain + application** tests at the base. Fewer **infrastructure** integration tests in the middle. A small handful of **end-to-end** tests at the top (driving the composition root). The pyramid bends to a "test trophy" if integration tests give better confidence-per-second than units do — but never invert it. A codebase whose only safety net is end-to-end tests is brittle and slow.

## 10.3 Conventions

- Tests live in `tests/` mirroring `src/` exactly.
- Test files end in `.test.ts` and are named after the unit under test (`create-user.test.ts`).
- Use `describe(SubjectName, …)` + `it("does something when …")` — one `it` per behavior.
- **AAA / Given-When-Then** structure inside each `it`. A blank line separates Arrange from Act and Act from Assert. If you can't tell the three apart at a glance, the test is doing too much.
- Tests may import domain entities to construct fixtures — that's fine, tests are outer-layer.
- Tests **must not** import a use-case class to satisfy a presentation-layer test; mock the input port.
- **Domain tests must not import infrastructure.** A failing `domain/` test should never require Postgres, fs, or a clock. If you reach for an adapter to test a domain rule, the test is in the wrong layer.
- **Test Data Builders.** Construct fixtures via builders (`aUser().withEmail("…").build()`) rather than ad-hoc literals scattered across tests. Builders live in `tests/<context>/builders/<noun>-builder.ts` and call the entity's `static create` (or `reconstruct` for hydration scenarios). When invariants change, you fix one builder, not fifty tests.
- **Deterministic.** No `new Date()` or `Math.random()` inside the unit under test — pass port doubles. A test that fails at midnight is a bug in the test, not the code.
- **Isolated.** No shared mutable state between `it` blocks. Each test constructs its own fixtures. A test that requires a sibling test to have run first is broken.
- **Use the right Test Double name** (Meszaros — see [glossary.md](./glossary.md#test-terms-meszaros)). `mockUserRepository = new InMemoryUserRepository()` is wrong — that's a Fake.
- **Property-based tests** are appropriate for VOs with rich invariants (e.g., `Money.add` is associative + commutative; round-trip serialization). Use sparingly — they're slow and hard to debug. Don't reach for them when a few example tests would do.
- **Snapshot tests** are forbidden in domain/application code. They're tolerable in presentation for rendered output if they're small and reviewed, but they encode "what is" rather than "what should be" — easy to commit a regression as the new truth.

## 10.4 Contract tests for adapters

When more than one adapter implements the same output port, share a behavior suite that all adapters must satisfy. Place it at `tests/infrastructure/<concern>/<port>-contract.ts` exporting a `runContract(makeRepo: () => Repo)` function; each adapter's test file calls it with its own factory.

The contract suite covers, at minimum:

- **Round-trip identity.** Save an entity, load it, and assert structural equality (id, all VOs, all timestamps).
- **Upsert semantics.** Save an entity with id `X`, then save a _different_ entity with the same id — load returns the second one, not a duplicate.
- **Absence.** `findById` / `findByEmail` for a non-existent value returns `undefined`, never throws.
- **Independence between instances.** Two repository instances built by `makeRepo()` do not share state (or, if they intentionally do — e.g., backed by the same DB — the test asserts and documents that).
- **Optimistic concurrency** (if the aggregate has a `version` field): saving a stale version throws `ConcurrencyError`.
- **Pagination contract** (if the repository exposes one): `limit` is honored, `nextCursor` is `undefined` on the last page, an unknown cursor throws.
- **Multi-tenant isolation** (if the repository is tenant-scoped — see [cross-cutting.md](./cross-cutting.md#69-caching-rate-limiting-multi-tenancy-audit-feature-flags)): an entity saved under tenant A is not visible under tenant B.

This guarantees substitutability (LSP) at runtime, not just at the type level.

## 10.5 Architectural fitness function tests

Architecture rules that can be checked statically must be checked statically. Add tests in `tests/architecture/` that fail when:

- An `application/*` file imports from `infrastructure/*`.
- A `domain/*` file imports from `application/*`, `infrastructure/*`, or `presentation/*`.
- A `presentation/*` file imports a use-case class (vs. its input port).
- A bounded context (`domain/<a>/`) imports from another bounded context (`domain/<b>/`).
- Any file outside a composition root contains `new <ConcreteAdapter>(`.
- A `tests/domain/*` file imports from `infrastructure/*`.

Implement with a directory walk + import parse, or a tool like `dependency-cruiser` or `eslint-plugin-import` with custom rules. The exact tool is a detail; the rules above are not.

---

**See also:** [dependency-rule.md](./dependency-rule.md) · [ports-adapters.md](./ports-adapters.md) · [forbidden-patterns.md](./forbidden-patterns.md) · [verification.md](./verification.md)
