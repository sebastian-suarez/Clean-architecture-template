# Naming and file conventions

The full naming table for every concept the template ships, plus TypeScript-specific conventions and project-wide formatting rules. The kernel `AGENTS.md` carries the table inline; this file is the authoritative reference for both the table and the surrounding rules.

| Concept              | File suffix / pattern                       | Example                                                        |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Entity               | `<name>.ts`                                 | `domain/user/user.ts`                                          |
| Value object         | `<name>.ts`                                 | `domain/user/email.ts`                                         |
| Typed id             | `<name>-id.ts`                              | `domain/user/user-id.ts`                                       |
| Domain error         | grouped in `errors.ts` per aggregate        | `domain/user/errors.ts`                                        |
| Domain service       | `services/<name>.ts`                        | `domain/order/services/pricing.ts`                             |
| Domain event         | `events/<name>.ts`                          | `domain/order/events/order-cancelled.ts`                       |
| Domain factory       | `factories/<name>-factory.ts`               | `domain/order/factories/order-factory.ts`                      |
| Specification        | `specifications/<name>-spec.ts`             | `domain/user/specifications/active-user-spec.ts`               |
| Use case             | `<verb>-<noun>.ts`                          | `application/use-cases/create-user.ts`                         |
| Use-case decorator   | `<adjective>-<verb>-<noun>.ts`              | `application/use-cases/logged-create-user.ts`                  |
| Application factory  | `factories/<name>-factory.ts`               | `application/factories/order-factory.ts`                       |
| Saga                 | `sagas/<name>.ts`                           | `application/sagas/order-confirmation-saga.ts`                 |
| Saga state aggregate | `<name>-process.ts`                         | `domain/order/order-process.ts`                                |
| Projector            | `projections/<name>-projector.ts`           | `application/projections/order-summary-projector.ts`           |
| Input port           | `<verb>-<noun>-use-case.ts`                 | `application/ports/input/create-user-use-case.ts`              |
| Output port          | `<noun>.ts`                                 | `application/ports/output/user-repository.ts`                  |
| Read-model port      | `<noun>-read-model.ts`                      | `application/ports/output/user-read-model.ts`                  |
| Output boundary      | `<verb>-<noun>-output.ts`                   | `application/ports/output/create-user-output.ts`               |
| DTO                  | `<noun>-dto.ts`                             | `application/dtos/user-dto.ts`                                 |
| Mapper               | `<noun>-mapper.ts` (camelCase const export) | `application/mappers/user-mapper.ts`                           |
| Adapter              | `<tech>-<port>.ts`                          | `infrastructure/persistence/json-file-user-repository.ts`      |
| Adapter decorator    | `<adjective>-<port>.ts`                     | `infrastructure/persistence/cached-user-repository.ts`         |
| Persistence record   | `<noun>-record.ts`                          | `infrastructure/persistence/user-record.ts`                    |
| HTTP route file      | grouped per resource                        | `presentation/http/routes/users.ts`                            |
| CLI command          | `<verb>-<noun>.ts`                          | `presentation/cli/commands/create-user.ts`                     |
| Test data builder    | `<noun>-builder.ts`                         | `tests/user/builders/user-builder.ts`                          |
| Contract test        | `<port>-contract.ts`                        | `tests/infrastructure/persistence/user-repository-contract.ts` |
| Architecture test    | `<rule>.arch.test.ts`                       | `tests/architecture/dependency-rule.arch.test.ts`              |

## 7.1 TypeScript-specific conventions

- Use `.js` import specifiers in TS sources (Node ESM resolution).
- Use the `#layer/*` aliases — never `../../../`.
- `kebab-case` filenames; `PascalCase` classes; `camelCase` consts and functions.
- Domain error codes: `SCREAMING_SNAKE_CASE` strings.
- **`import type`** for type-only imports — keeps the runtime import graph minimal and prevents accidental value imports across layer boundaries.
- **Branded types** for opaque domain primitives (`type UserId = string & { readonly __brand: "UserId" }`) when a full VO class is overkill — see [domain-modeling.md](./domain-modeling.md#32-value-objects).
- **Discriminated unions** for sum types (`type OrderStatus = { kind: "open" } | { kind: "cancelled"; reason: string }`). Prefer over enums + optional fields.
- **No barrel files** (`index.ts` re-exporting from a folder). Barrels obscure the dependency graph, defeat tree-shaking, and make architectural fitness tests harder to write. Import from the source file directly.
- **One concept per file** (SRP at file level). Multiple closely-related types in one file is acceptable when they form a single concept (e.g., `CreateUserInput` + `CreateUserUseCase` together). Unrelated concepts go in separate files.
- **No default exports.** Named exports only — they grep cleanly, rename safely, and keep import names consistent across the codebase.
- **Use `readonly` on every field**, every array (`readonly T[]`), every tuple position. Mutability is opt-in, not opt-out.
- **No `any`.** Use `unknown` at boundaries, narrow with `instanceof` / type guards.

## 7.2 Other conventions

- Each direct subfolder of `src/domain/` is a **bounded context** with its own ubiquitous language. Don't reuse a name (`User`, `Order`) across two contexts; if you need both, prefix or namespace.
- Use **tabs** for indentation (matches XO/Prettier config).
- Code is formatted by Prettier; lint is enforced by XO. Local exceptions in `xo.config.ts` must be scoped to the smallest possible file glob and justified inline.
- Pre-commit hooks (Husky + lint-staged) run `xo --fix` and `prettier --write` on staged files. Don't bypass them.

---

**See also:** [layer-responsibilities.md](./layer-responsibilities.md) · [forbidden-patterns.md](./forbidden-patterns.md) · [recipes.md](./recipes.md)
