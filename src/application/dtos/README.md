# src/application/dtos/

Plain primitives-only data shapes that cross the
application↔presentation boundary. `readonly` everywhere, no methods,
no `Date`/`Map`/`Set`/`BigInt`/class instances. Must round-trip
through `JSON.stringify` losslessly. Field names are part of the
public API — additive evolution only.

→ Rules: [../../../docs/architecture/application.md#46-dto-contract](../../../docs/architecture/application.md#46-dto-contract)
