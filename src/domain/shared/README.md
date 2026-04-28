# src/domain/shared/

Cross-cutting domain primitives — `DomainError`, `DomainEvent`,
`ConcurrencyError`, `ForbiddenError`. Shared by every bounded context.
Keep this folder small: bounded contexts duplicate before they share
(see [docs/architecture/cross-cutting.md](../../../docs/architecture/cross-cutting.md#65-inter-context-communication)).

→ Rules: [../../../docs/architecture/domain-modeling.md](../../../docs/architecture/domain-modeling.md)
