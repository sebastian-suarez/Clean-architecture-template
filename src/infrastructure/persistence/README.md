# src/infrastructure/persistence/

Repository adapters. Each adapter uses a `<noun>-record.ts` mapper
between the domain entity and the persistence shape; record types
stay inside this directory. Optimistic concurrency, pagination, and
multi-tenant isolation are enforced by every adapter (including
in-memory) so contract tests can verify substitutability.

→ Rules: [../../../docs/architecture/ports-adapters.md#52-repository-rules](../../../docs/architecture/ports-adapters.md#52-repository-rules)
→ Contract test pattern: [../../../docs/architecture/testing.md#104-contract-tests-for-adapters](../../../docs/architecture/testing.md#104-contract-tests-for-adapters)
