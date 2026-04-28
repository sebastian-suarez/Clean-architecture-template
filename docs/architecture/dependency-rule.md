# The dependency rule and architectural principles

The single rule that the entire template enforces: **source-code dependencies always point inward**. This module also covers SOLID at file scale, Uncle Bob's component principles at module scale, the named principles applied throughout, boundary anatomy, and how this template positions itself across Clean Architecture, Hexagonal, and Onion.

## 1.1 The dependency rule

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

The dependency rule is a direct application of the **Dependency Inversion Principle (DIP)**: high-level policy (use cases, entities) does not depend on low-level detail (HTTP frameworks, file systems). When you feel an inner layer needs something from an outer layer, define a **port** (interface) in the inner layer and have the outer layer **implement** it.

## 1.2 SOLID

- **SRP (Single Responsibility)** — One concept per file. One port per adapter file. "Reason to change" is defined by the actor: code changes for the actor that owns it. If two actors push changes into the same class, split it.
- **OCP (Open/Closed)** — Extend behavior by adding a new use case / adapter / decorator, not by modifying existing ones. Wrap, don't edit.
- **LSP (Liskov Substitution)** — Adapters and fakes implementing a port are fully substitutable. Contract tests (see [testing.md](./testing.md#104-contract-tests-for-adapters)) enforce this at runtime.
- **ISP (Interface Segregation)** — Ports are narrow. `Clock` exposes only `now()`, not unrelated time helpers. Consumers depend on the smallest port that does the job.
- **DIP (Dependency Inversion)** — Depend on abstractions, never on concretions. Inner layers own the abstraction; outer layers implement it.

## 1.3 Component principles (Uncle Bob, Part IV)

Components in this codebase = top-level layers and bounded contexts. The cohesion/coupling principles operate at that scale.

**Cohesion — what belongs together in one component:**

- **REP (Reuse-Release Equivalence)** — The unit of reuse is the unit of release. A component is versioned and released as a whole.
- **CCP (Common Closure)** — Group classes that change for the same reasons. Things that change together belong together. (This is SRP at component scale.)
- **CRP (Common Reuse)** — Don't force consumers to depend on things they don't use. Group classes that are reused together. (This is ISP at component scale.)

These three are in tension: maximizing one hurts the others. The template trades CRP for CCP inside a bounded context (one folder per context, fine-grained reuse not a goal) and trades CCP for CRP across contexts (no shared kernel by default — see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)).

**Coupling — how components depend on each other:**

- **ADP (Acyclic Dependencies Principle)** — **No cycles between components.** No bounded context may import from a bounded context that imports it back, directly or transitively. The composition root is the only allowed point of cycle resolution. Enforce with an architectural fitness function (see [testing.md](./testing.md#105-architectural-fitness-function-tests)).
- **SDP (Stable-Dependencies)** — Depend in the direction of stability. `domain/` is the most stable; `presentation/` and `infrastructure/` are the least. Stability = how hard the component is to change without breaking dependents.
- **SAP (Stable-Abstractions)** — Stable components must also be abstract. `domain/` is stable _and_ abstract (mostly types and pure logic). An adapter is unstable _and_ concrete. A stable concrete component is a smell — it can't bend without breaking everyone.

## 1.4 Other named principles applied throughout

- **Screaming Architecture** — The directory layout reflects the domain (`src/domain/<context>/`), not the framework. A reader infers "this is a user-management system" from `src/`, not "this is a Hono app."
- **Plugin Architecture** — Outer layers are plugins to inner layers. Removing or replacing infrastructure / presentation must require zero changes in `application/` or `domain/`.
- **Persistence Ignorance** — Domain types know nothing about how they are stored. No ORM annotations, no `@Column`, no schema decorators on entities or VOs. If a persistence concern leaks (a `_v` MongoDB version field, a SQL-shaped flag), translate at the mapper.
- **Humble Object** — Presentation routes and CLI commands stay thin, doing only transport translation. All testable logic lives behind input ports so it can be exercised without booting a server. Same idea on the way out: the Output Boundary lets the use case stay testable when rendering is non-trivial (see [application.md](./application.md#48-output-boundary-presenter-port)).
- **Hollywood Principle ("don't call us, we'll call you")** — Inner layers don't pull from outer layers; outer layers register/inject themselves. The composition root is where the calling happens.
- **Tell, Don't Ask** — Send messages to objects that own the data; don't pull data out and decide elsewhere. `order.cancel(reason)` over `if (order.status === "open") order.status = "cancelled"`. Asks-then-decides logic in a use case is a sign that behavior should move into the entity.
- **Law of Demeter** — A method talks only to its immediate collaborators (params, fields, locals, things it constructs). `user.address.city.zip` is a smell; expose `user.zip()` if zip is a meaningful concept, otherwise keep the chain inside the aggregate.
- **YAGNI ("You Aren't Gonna Need It")** — Don't add a port, abstraction, decorator, or "hook" because you might need it. Wait for the second concrete use.
- **DRY (and its limits)** — Don't duplicate knowledge _within a bounded context_. **Do duplicate across bounded contexts** when the two concepts merely happen to share a name. Coupling two contexts to a shared model is more expensive than two slightly-different `User` types.
- **Boy Scout Rule** — Leave the campsite cleaner than you found it. Acceptable to fix a small unrelated nit while you're in a file; not acceptable to expand a small change into a refactor that obscures the diff.
- **Volatility-based decomposition** — Where possible, draw component boundaries between things that change at different rates. The dependency rule already does this (rules > use cases > adapters > UI), but it applies inside layers too: split a use case file when half of it churns weekly and half is stable.

## 1.5 Boundary anatomy

When data crosses an architectural boundary:

- **Outward** (use case → presentation): pass a **DTO** (see [application.md](./application.md#46-dto-contract)). Never an entity, VO, or class instance.
- **Inward** (presentation → use case): pass a primitives-only **input DTO** (`CreateUserInput`). Validation of business meaning happens inside.
- **Across** (one context to another): pass through a port owned by the consumer (see [cross-cutting.md](./cross-cutting.md#65-inter-context-communication)). Never a direct entity reference.

Boundaries are crossed by **data**, not by **objects with behavior**. If a value crossing a boundary has methods that the other side might call, the boundary is leaking.

## 1.6 What "Clean Architecture" inherits from related styles

This template is the intersection of three traditions; all are honored:

- **Clean Architecture (Martin)** — concentric circles, dependency rule, use cases at the center.
- **Hexagonal / Ports & Adapters (Cockburn)** — ports as the symmetric boundary; driving (input) and driven (output) sides; adapters as plugins.
- **Onion Architecture (Palermo)** — domain at the center; application services around it; infrastructure on the outside; explicit invertion via interfaces in inner layers.

When the templates pick a side, they pick Hexagonal vocabulary (port/adapter), Clean's concentric model, and DDD's tactical patterns inside the domain.

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [forbidden-patterns.md](./forbidden-patterns.md) · [reading-list.md](./reading-list.md)
