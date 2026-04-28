# src/infrastructure/id/

Adapters for the `IdGenerator` output port. Identifiers enter the
system here so domain and application code never call `randomUUID()`
or `Math.random()` directly.

→ Rules: [../../../docs/architecture/cross-cutting.md#62-time-and-identity](../../../docs/architecture/cross-cutting.md#62-time-and-identity)
