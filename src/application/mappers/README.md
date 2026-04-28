# src/application/mappers/

Pure functions translating domain entities ↔ DTOs at the outward
boundary. Direction-explicit names (`toDto`, `toDomain`). Total: must
either succeed for the entire input domain or throw a `DomainError`.
No I/O, no `new Date()`, no logging.

→ Rules: [../../../docs/architecture/application.md#47-mapper-rules](../../../docs/architecture/application.md#47-mapper-rules)
