# src/application/use-cases/

One class per business operation. Imperative names (`create-user.ts`,
not `user-service.ts`). Implements an input port, returns a DTO (or
invokes an Output Boundary). Stateless. Cross-cutting concerns
(logging, auth, retries) are added via decorator classes that wrap
an inner use case and implement the same port.

→ Rules: [../../../docs/architecture/application.md](../../../docs/architecture/application.md)
→ Recipe: [../../../docs/architecture/recipes.md#81-add-a-new-use-case-to-an-existing-aggregate](../../../docs/architecture/recipes.md#81-add-a-new-use-case-to-an-existing-aggregate)
