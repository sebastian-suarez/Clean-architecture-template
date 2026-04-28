# src/infrastructure/logging/

Adapters for the `Logger` output port (console / pino / cloud-logging
backends). Log fields are structured, never f-string interpolations.
Never log secret-bearing fields.

→ Rules: [../../../docs/architecture/cross-cutting.md#61-logging](../../../docs/architecture/cross-cutting.md#61-logging)
