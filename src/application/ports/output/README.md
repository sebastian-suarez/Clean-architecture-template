# src/application/ports/output/

Driven (output) ports — TypeScript types describing the side-effects
each use case needs (repository, clock, id generator, logger, …).
Adapters in `infrastructure/` `implements` them. Narrow (ISP);
domain types only in signatures, never persistence shapes.

→ Rules: [../../../../docs/architecture/ports-adapters.md](../../../../docs/architecture/ports-adapters.md)
