# src/infrastructure/clock/

Adapters for the `Clock` (and optionally `Monotonic`) output port.
The current time enters the system here so use cases stay
deterministic given their inputs and port doubles.

→ Rules: [../../../docs/architecture/cross-cutting.md#62-time-and-identity](../../../docs/architecture/cross-cutting.md#62-time-and-identity)
