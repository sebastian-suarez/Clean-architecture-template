# Clean Architecture Template

A TypeScript + Node.js (ESM) template that scaffolds a project around **Clean Architecture** / **Ports & Adapters** / **DDD**. Fork it, add your aggregates, ship. The dependency rule is enforced by tests; the lean `AGENTS.md` keeps your agent's token budget intact; the depth lives in `docs/architecture/` and is loaded on demand. Everything beyond the rules is deliberately empty — this is scaffolding, not an example app.

> **Read [`AGENTS.md`](./AGENTS.md) before contributing.** It is the binding contract for layer boundaries, naming, forbidden patterns, and testing conventions.

---

## What you get

- Layered structure (`domain` / `application` / `infrastructure` / `presentation`) with the **dependency rule enforced by architectural fitness tests**
- Composition roots for **CLI / HTTP / queue** (each with its own `src/<delivery>.ts` entrypoint)
- A `domain/shared/` kernel: `DomainError`, `DomainEvent`, `ConcurrencyError`, `ForbiddenError`
- ADR + context-map docs scaffolding under `docs/`
- A lean `AGENTS.md` (~3K tokens) plus 14 on-demand modules under `docs/architecture/` for depth
- TypeScript ESM with `#layer/*` import aliases, Vitest, XO, Prettier, Husky + lint-staged

## What you do not get

- Example aggregates — User and Order were deliberately stripped after extracting their patterns into `docs/architecture/recipes.md`
- A working API or CLI — `npm start` / `npm run serve` boot empty composition roots; you wire your own
- Cross-cutting infrastructure adapters (Logger, Clock, Cache, …) — define the port and the in-memory adapter when you have a consumer (recipe in `docs/architecture/recipes.md`)

## Start here

1. Click **Use this template** on GitHub (or `git clone` and re-init).
2. Update `name`, `description`, and repo URLs in `package.json`.
3. Read [`AGENTS.md`](./AGENTS.md) — it lives in your agent's context for free.
4. When you need depth on a topic, read the matching module in [`docs/architecture/`](./docs/architecture/).
5. Add your first aggregate following [`docs/architecture/recipes.md#82-add-a-new-entity--aggregate`](./docs/architecture/recipes.md#82-add-a-new-entity--aggregate).

## Scripts

| Script           | What it does                                      |
| ---------------- | ------------------------------------------------- |
| `npm start`      | Run the CLI composition root (`src/index.ts`)     |
| `npm run serve`  | Run the HTTP composition root on `PORT`           |
| `npm run worker` | Run the queue worker composition root             |
| `npm test`       | Run Vitest, including architectural fitness tests |
| `npm run lint`   | Lint with XO (autofix)                            |
| `npm run format` | Format with Prettier                              |

## Layout

```
src/
├── domain/
│   └── shared/                         (DomainError, DomainEvent, …)
├── application/
│   ├── dtos/        ports/{input,output}/        use-cases/        mappers/
├── infrastructure/
│   └── clock/       id/       logging/       persistence/
├── presentation/
│   └── cli/         http/         queue/
├── composition.ts                      (shared composition module)
├── config.ts                           (only file allowed to read process.env)
├── index.ts                            (CLI composition root)
├── server.ts                           (HTTP composition root)
└── worker.ts                           (queue composition root)

docs/
├── architecture/                       (14 on-demand modules)
├── adr/                                (Architecture Decision Records)
└── context-map.md                      (Bounded-context relationships)

tests/
└── architecture/                       (Fitness function tests — keep green)
```

## Token budget note

`AGENTS.md` is intentionally lean (~3K tokens). Every section there links into `docs/architecture/*.md` for depth. Modules are loaded by your agent on demand. **Keep it that way** — every line you add to the kernel is a line every agent turn pays for. When in doubt, link out.
